/**
 * models/worksite.js
 * ----------------------------------------------------------------------------
 * The construction site's dressing every monument shares while it is built:
 * scaffolds, cranes, timber centering under arches and domes, the stacks of
 * goods the camp's carts bring, a mortar pit, and the rubble raiders leave.
 * A monument's stage variant declares what stands where (`site`), in its own
 * metres; siteParts() turns that into geometry merged into the stage's kit.
 *
 * From the record of Roman building practice rather than any game's art:
 *   - Scaffolds: poles (standards) lashed with rope to horizontal ledgers,
 *     short putlogs run from the ledgers into holes left in the wall (the
 *     putlog holes still pock the Colosseum's and Aurelian's walls, in rows
 *     about 1.3 m apart), boards laid across the putlogs as each working
 *     lift, braces across the bays, ladders between lifts.
 *   - The treadwheel crane: the relief on the tomb of the Haterii (Vatican
 *     Museums) shows a two-legged jib held by stays, a great wheel at its
 *     foot with men walking inside it, and a polyspastos (Vitruvius X.2:
 *     an upper block of three sheaves, a lower one of two, five falls of
 *     rope) lifting the load; a lewis or iron tongs grip the block.
 *   - Shear legs (Vitruvius X.2.1): two timbers lashed at the top and
 *     spread at the foot, held by a stay, a block at the top and the rope
 *     run down to a windlass between the legs.
 *   - Centering: a timber frame of ribs on props carrying boards (the
 *     lagging) on which an arch's voussoirs or a vault's concrete were
 *     laid; the Pantheon's dome rose on such a frame, its ribs meeting a
 *     ring round the oculus.
 *   - Materials on the site: marble blocks and column drums on bearers,
 *     squared timber in crossed stacks, bricks and tiles in crossed courses
 *     on pallets, iron in bars and blooms, a pit of slaked lime for mortar
 *     beside its heap of pozzolana.
 *
 * The site (all lists optional; metres, y up, facing +z, the footprint
 * centred on 0,0):
 *   scaffolds  [{ x, z, w, d, h, ry, fallen }]  a ring of standards w x d
 *              round a wall or pier, lifts every 1.5 m to h; `fallen`:
 *              toppled by raiders, its poles strewn
 *   cranes     [{ x, z, ry, h, kind, work, load }]  kind 'treadwheel' (the
 *              jib's head h up, the wheel at its foot, the load hanging
 *              ahead along +z) or 'shear' (shear legs); `work` true: the
 *              wheel turns and the load rises (siteMotion draws the wheel,
 *              the load and its falls; siteParts leaves them out), else the
 *              crane is still and its load rests on the ground; `load`
 *              'marble' (a block, the default) | 'drum' (a column drum) |
 *              'timber' (a beam)
 *   centering  [{ x, z, ry, span, rise, depth, y }]  an arch's frame, its
 *              span across x, its depth along z, springing `y` up (props
 *              down to the ground under it); or { x, z, dome: r, y, lag }
 *              a dome's (ribs, rings, a tower to the oculus; `lag` the
 *              share of the dome's height lagged, 1 by default)
 *   piles      [{ x, z, ry, good, n }]  'marble' | 'timber' | 'clay' |
 *              'iron' | 'stone', n loads (each a stack, up to 9)
 *   mortar     [{ x, z, ry }]  a lime pit with its heap of pozzolana
 *   rubble     [{ x, z, ry, w, d }]  broken stone heaped by raiders
 *   crew       [actor, ...]  the people system's actors (people/actors.js);
 *              siteActors() adds the men every working crane needs
 *
 * siteParts(site, lod) -> [{ g, material, name, cast }]: one geometry a
 * material (fresh copies of a cache kept by the site's content and level,
 * so a caller may merge and free them), to add to the stage's kit by name
 * (TaggedParts). Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, BufferGeometry, Float32BufferAttribute, CylinderGeometry, TorusGeometry, IcosahedronGeometry, Matrix4, Quaternion, Vector3, Euler } from 'three';
import { boxUV, tintGeometry, tube, revolve, profileOf } from '../shapes.js';
import { material } from '../materials.js';
import { artRng } from '../texgen.js';
import { slab, TaggedParts } from './masonry.js';
import { WINDLASS, WALK_SPEED } from '../people/clips.js';
import { MONUMENT_TYPES, CAMP } from '../../data/monuments.js';
import { raidKey } from '../../sim/monuments.js';
import { closedReason } from '../../sim/monumentEffects.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Measures the cranes, the tests and the people read
// ---------------------------------------------------------------------------

/**
 * The treadwheel (magnus tympanum): its radius to the rims' outer edge, the
 * floor of treads the men walk on (its radius), the wheel's width between
 * the rims, the axle's height, the drum the rope winds on, and the speed of
 * the floor under the men's feet (m/s): a slow walk, as men treading a
 * wheel all day would keep.
 */
export const TREAD = Object.freeze({ R: 2.3, floor: 2.12, width: 1.1, axleY: 2.55, drum: 0.33, pace: 0.85, spokes: 8 });

/** The treaders' speed for their walking clip: their feet move back as fast as the floor. */
export const TREAD_SPEED = TREAD.pace / WALK_SPEED;

/** Where the jib's head hangs its load: ahead of the wheel's axle (z, crane's frame) by the jib's lean. */
export function craneReach(h) {
  return 1.4 + h * 0.26;
}

/** A treadwheel crane's lifting cycle (s): the load rising, set off at the top, the hook back down unseen. */
export function liftCycle(h) {
  const climb = Math.max(1, h - 2.8);
  const rise = climb / ((TREAD.pace / TREAD.floor) * TREAD.drum);
  return { climb, rise, period: rise + 3 };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** A box w x h x d, its foot at (x, y, z), UVs in metres, a vertex tone k. */
function box(w, h, d, x, y, z, k = 1) {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return tintGeometry(boxUV(g), () => k);
}

/** Segments round a pole at a level of detail: a pole is thin, so few. */
const POLE_SEG = [6, 5, 3];

/**
 * A round pole from a to b ([x, y, z]), radius r: a trimmed young tree,
 * not quite straight at the full level, its ends left open (each is buried,
 * lashed or out of sight against another).
 */
function pole(a, b, r, lod, seed = 1) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 1e-3;
  const g = new CylinderGeometry(r * 0.85, r, len, POLE_SEG[lod], lod === 0 && len > 2 ? 3 : 1, true);
  if (lod === 0 && len > 2) {
    const p = g.attributes.position;
    const bend = 0.02 * Math.sin(seed * 12.9898);
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / len + 0.5;
      p.setX(i, p.getX(i) + Math.sin(t * Math.PI) * bend * Math.min(2, len / 3));
    }
    g.computeVertexNormals();
  }
  g.translate(0, len / 2, 0);
  g.rotateX(Math.acos(Math.max(-1, Math.min(1, dy / len))));
  g.rotateY(Math.atan2(dx, dz));
  g.translate(a[0], a[1], a[2]);
  const tone = 0.82 + 0.18 * (((seed * 0.6180339) % 1 + 1) % 1);
  return tintGeometry(boxUV(g), () => tone);
}

/** A squared timber from a to b, w x w (rural.js beam's shape: a plain box turned onto the line). */
function timber(a, b, w, k = 1, hgt = w) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.max(1e-3, Math.hypot(dx, dy, dz));
  const g = new BoxGeometry(w, len, hgt);
  g.translate(0, len / 2, 0);
  g.rotateX(Math.acos(Math.max(-1, Math.min(1, dy / len))));
  g.rotateY(Math.atan2(dx, dz));
  g.translate(a[0], a[1], a[2]);
  return tintGeometry(boxUV(g), () => k);
}

/** A rope from a to b sagging `sag` at its middle (a stay, a lashing run). */
function rope(a, b, r, lod, sag = 0) {
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag, (a[2] + b[2]) / 2];
  const pts = sag ? [a, m, b] : [a, b];
  return tube(pts, r, { radial: lod ? 3 : 5, segments: sag ? (lod ? 4 : 10) : 1, around: 0.06 });
}

/** Turn a geometry by ry about y and stand it at (x, y, z): an item's own frame into the site's. */
function place(g, x, z, ry, y = 0) {
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

/** A bag of geometry lists by material, filled by the pieces below. */
function bins() {
  return { poles: [], wood: [], rope: [], iron: [], marble: [], brick: [], stone: [], tufa: [], lime: [], sand: [], rubble: [], earth: [] };
}

/** Move every geometry an item made (from `from`, a bins()) into `to`, placed by (x, z, ry). */
function moveInto(to, from, x, z, ry, y = 0) {
  for (const k of Object.keys(from)) for (const g of from[k]) to[k].push(place(g, x, z, ry, y));
}

// ---------------------------------------------------------------------------
// Scaffolds
// ---------------------------------------------------------------------------

/** Lifts every this many metres up a scaffold: about a man and a half, as the putlog holes' rows run. */
export const LIFT = 1.5;
/** How far a scaffold's boards reach in from its standards toward the wall. */
const BAND = 0.85;

/** Standards along a side from a to b (scalars), about `step` apart, both ends included. */
function stations(a, b, step = 2.1) {
  const n = Math.max(1, Math.round(Math.abs(b - a) / step));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

/** A scaffold standing, in its own frame (the ring's middle at 0, 0). */
function scaffoldStanding(s, lod, seed, out) {
  const hw = s.w / 2;
  const hd = s.d / 2;
  const band = Math.min(BAND, hw * 0.8, hd * 0.8);
  const lifts = [];
  for (let y = LIFT; y <= s.h + 0.01; y += LIFT) lifts.push(y);
  if (!lifts.length) lifts.push(Math.max(0.6, s.h));
  const top = lifts[lifts.length - 1] + 1.0;
  const r = 0.055;
  // The standards round the ring, a little in from its edge (so the ring's outline is the box given).
  const ring = [];
  const e = r;
  for (const x of stations(-hw + e, hw - e)) ring.push([x, -hd + e, 0, -1], [x, hd - e, 0, 1]);
  for (const z of stations(-hd + e, hd - e).slice(1, -1)) ring.push([-hw + e, z, -1, 0], [hw - e, z, 1, 0]);
  ring.forEach(([x, z], i) => out.poles.push(pole([x, 0, z], [x + 0.02 * Math.sin(i * 1.7), top - 0.25 * ((i * 0.37) % 1), z], r, lod, seed + i)));
  // The ledgers along each side at each lift, and the putlogs from them in to the wall.
  for (const [k, y] of lifts.entries()) {
    const ly = y - 0.06;
    for (const s2 of [-1, 1]) {
      out.poles.push(pole([-hw + e, ly, s2 * (hd - e - 0.06)], [hw - e, ly, s2 * (hd - e - 0.06)], r * 0.85, lod, seed + 40 + k * 4 + s2));
      out.poles.push(pole([s2 * (hw - e - 0.06), ly - 0.1, -hd + e], [s2 * (hw - e - 0.06), ly - 0.1, hd - e], r * 0.85, lod, seed + 60 + k * 4 + s2));
    }
    if (lod < 2) {
      for (const [x, z, nx, nz] of ring) {
        // (In from the standard, square to its side, into a putlog hole: the board's bearers.)
        const len = band + 0.35;
        out.wood.push(timber([x - nx * 0.05, y, z - nz * 0.05], [x - nx * len, y, z - nz * len], 0.08, 0.8, 0.06));
      }
    }
    // The boards: three planks across the band on the long sides, the short sides between them.
    const by = y + 0.03;
    const planks = lod === 0 ? 3 : 1;
    const pw = band / planks;
    for (let p = 0; p < planks; p++) {
      const inset = e + pw * (p + 0.5);
      const t = lod === 0 ? 0.035 : 0.04;
      const kk = 0.86 + 0.14 * (((k * 3 + p) * 0.618) % 1);
      for (const s2 of [-1, 1]) {
        out.wood.push(box(s.w - 2 * e, t, pw - 0.02, 0, by, s2 * (hd - inset), kk));
        if (s.d - 2 * (e + band) > 0.2) out.wood.push(box(pw - 0.02, t, s.d - 2 * (e + band), s2 * (hw - inset), by, 0, kk * 0.95));
      }
    }
  }
  // Braces: a long pole across each face, bay to bay, lashed to the standards.
  if (lod < 2) {
    const yTop = lifts[lifts.length - 1];
    for (const s2 of [-1, 1]) {
      const z = s2 * (hd - e + 0.06);
      out.poles.push(pole([-hw + e, 0.15, z], [Math.min(hw - e, -hw + e + yTop * 1.1), yTop - 0.1, z], r * 0.8, lod, seed + 80 + s2));
      if (s.w > 4) out.poles.push(pole([hw - e, 0.15, z], [Math.max(-hw + e, hw - e - yTop * 1.1), yTop - 0.1, z], r * 0.8, lod, seed + 84 + s2));
    }
  }
  // Lashings where the ledgers cross the standards (close up only: a few pixels each).
  if (lod === 0) {
    for (const [i, [x, z]] of ring.entries()) {
      for (const y of lifts) {
        const c = new CylinderGeometry(r * 1.35, r * 1.35, 0.1, 6, 1, true);
        c.translate(x, y - 0.08, z);
        out.rope.push(tintGeometry(boxUV(c), () => 0.75 + 0.1 * (i % 2)));
      }
    }
  }
  // A ladder up the front face (+z), outside the standards: two rails, a rung every 0.3 m.
  const lx = hw - Math.min(1.0, hw * 0.5);
  const lz = hd + 0.18;
  const lTop = lifts[lifts.length - 1] + 0.9;
  const lean = 0.25;
  for (const sx of [-0.22, 0.22]) out.wood.push(timber([lx + sx, 0, lz + lean], [lx + sx, lTop, lz], 0.06, 0.85));
  if (lod < 2) {
    for (let y = 0.3; y < lTop - 0.1; y += 0.3) {
      const zz = lz + lean * (1 - y / lTop);
      out.wood.push(box(0.44, 0.035, 0.035, lx, y, zz, 0.8));
    }
  }
}

/** A scaffold raiders brought down: its poles and boards strewn across its ground, a few still standing. */
function scaffoldFallen(s, lod, seed, out) {
  const rnd = artRng(seed * 31 + 7);
  const hw = s.w / 2;
  const hd = s.d / 2;
  const n = Math.max(4, Math.round((s.w + s.d) * 0.9));
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    const L = Math.min(Math.max(s.w, s.d), 2.5 + rnd() * 3);
    const cx = (rnd() - 0.5) * (s.w - 0.4);
    const cz = (rnd() - 0.5) * (s.d - 0.4);
    const ax = Math.cos(a) * L * 0.5;
    const az = Math.sin(a) * L * 0.5;
    const clamp = (v, h) => Math.max(-h + 0.1, Math.min(h - 0.1, v));
    const p = [clamp(cx - ax, hw), 0.06 + rnd() * 0.12, clamp(cz - az, hd)];
    const q = [clamp(cx + ax, hw), 0.06 + rnd() * 0.25, clamp(cz + az, hd)];
    if (i % 3 === 2) out.wood.push(box(0.25, 0.035, Math.hypot(q[0] - p[0], q[2] - p[2]), 0, 0, 0, 0.7).rotateY(Math.atan2(q[0] - p[0], q[2] - p[2])).translate((p[0] + q[0]) / 2, 0.04 + rnd() * 0.1, (p[2] + q[2]) / 2));
    else out.poles.push(pole(p, q, 0.055, lod, seed + i));
  }
  // Two standards left leaning where they stood.
  for (const [k, sx] of [[0, -1], [1, 1]]) {
    const x = sx * (hw - 0.1);
    out.poles.push(pole([x, 0, -hd + 0.1], [x + sx * -0.6, Math.min(s.h, 3.2) - 0.4 * k, -hd + 0.5], 0.055, lod, seed + 90 + k));
  }
}

function scaffold(s, lod, seed, out) {
  const own = bins();
  if (s.fallen) scaffoldFallen(s, lod, seed, own);
  else scaffoldStanding(s, lod, seed, own);
  moveInto(out, own, s.x || 0, s.z || 0, s.ry || 0);
}

// ---------------------------------------------------------------------------
// Cranes
// ---------------------------------------------------------------------------

/** The treadwheel itself, in its own frame: its axle along x at the origin. Rims, spokes, treads, the drum. */
export function wheelGeometry(lod) {
  const out = bins();
  const { R, floor, width, spokes, drum } = TREAD;
  const seg = lod === 0 ? 32 : lod === 1 ? 20 : 12;
  // Two rims of felloes, each a ring of timber (a torus squared off by few tube sides).
  for (const sx of [-1, 1]) {
    const rim = new TorusGeometry((R + floor) / 2, (R - floor) / 2, lod === 2 ? 3 : 4, seg);
    rim.rotateY(Math.PI / 2);
    rim.rotateX(Math.PI / 4 / seg);
    rim.translate(sx * width / 2, 0, 0);
    out.wood.push(tintGeometry(boxUV(rim), () => 0.82));
  }
  // The spokes on each side, hub to rim, crossing the axle as pairs (the relief's wheel shows them so).
  for (const sx of [-1, 1]) {
    for (let k = 0; k < spokes / 2; k++) {
      const a = (k / spokes) * TAU;
      const c = Math.cos(a) * floor;
      const s = Math.sin(a) * floor;
      out.wood.push(timber([sx * width / 2, -s, -c], [sx * width / 2, s, c], 0.1, 0.9, 0.08));
    }
  }
  // The treads across the floor, between the rims: what the men's feet push round.
  const treads = lod === 0 ? 36 : lod === 1 ? 20 : 0;
  for (let k = 0; k < treads; k++) {
    const a = (k / treads) * TAU;
    const g = new BoxGeometry(width + 0.08, 0.05, 0.16);
    g.translate(0, -floor + 0.025, 0);
    g.rotateX(a);
    out.wood.push(tintGeometry(boxUV(g), () => 0.78 + 0.12 * (k % 2)));
  }
  if (lod === 2) out.wood.push(tintGeometry(boxUV(new CylinderGeometry(floor, floor, width, 10, 1, true).rotateZ(Math.PI / 2)), () => 0.55));
  // The axle through the hub, and the drum the rope winds on beside the wheel, a coil of rope on it.
  out.wood.push(tintGeometry(boxUV(new CylinderGeometry(0.15, 0.15, width + 2.1, lod ? 8 : 12, 1).rotateZ(Math.PI / 2)), () => 0.7));
  out.wood.push(tintGeometry(boxUV(new CylinderGeometry(drum - 0.03, drum - 0.03, 0.42, lod ? 8 : 14, 1).rotateZ(Math.PI / 2).translate(width / 2 + 0.4, 0, 0)), () => 0.75));
  const coil = new CylinderGeometry(drum, drum, 0.36, lod ? 8 : 16, lod ? 1 : 6);
  coil.rotateZ(Math.PI / 2).translate(width / 2 + 0.4, 0, 0);
  out.rope.push(tintGeometry(boxUV(coil), (x) => 0.8 + 0.12 * Math.sin(x * 80)));
  return out;
}

/** A load as it hangs from the hook, its foot at y 0: the block (or drum, or beam), the lewis or the sling, the lower pulley block. */
export function loadGeometry(kind, lod) {
  const out = bins();
  let top;
  if (kind === 'drum') {
    const d = revolve(profileOf([[0, 0], [0.42, 0], [0.42, 0.6], [0, 0.6]]), { segments: lod ? 12 : 24, metres: 1 });
    out.marble.push(d);
    top = 0.6;
  } else if (kind === 'timber') {
    out.wood.push(box(0.28, 0.28, 4.2, 0, 0, 0, 0.85));
    top = 0.28;
    // A sling round the beam (rope), not a lewis.
    for (const z of [-0.5, 0.5]) out.rope.push(rope([0, top + 0.02, z], [0, top + 0.62, 0], 0.016, lod));
  } else {
    out.marble.push(slab(1.1, 0.62, 0.72, { bevel: 0.02, seed: 5, wobble: 0.004, tone: 0.04, grime: 0.1 }));
    top = 0.62;
  }
  if (kind !== 'timber') {
    // The lewis: an iron dovetail in a hole cut in the block's top, its shackle up to the hook.
    out.iron.push(box(0.08, 0.16, 0.05, 0, top - 0.02, 0, 0.8));
    if (lod < 2) out.iron.push(tube([[0, top + 0.12, -0.06], [0, top + 0.32, 0], [0, top + 0.12, 0.06]], 0.014, { radial: 4, segments: 6, around: 0.1 }));
    out.rope.push(rope([0, top + 0.28, 0], [0, top + 0.62, 0], 0.018, lod));
  }
  // The lower block of the polyspastos: two cheeks round its sheaves, its hook under.
  const by = top + 0.62;
  out.wood.push(box(0.2, 0.36, 0.3, 0, by, 0, 0.8));
  if (lod < 2) out.iron.push(box(0.04, 0.06, 0.2, 0, by + 0.36, 0, 0.7));
  return { ...out, top: by + 0.36 };
}

/** The height of a load's lower block's top over its foot (where the falls end). */
export function loadTop(kind) {
  return (kind === 'drum' ? 0.6 : kind === 'timber' ? 0.28 : 0.62) + 0.98;
}

/**
 * The falls of the polyspastos at unit length: five ropes hanging from y 0
 * to y -1 between the upper and the lower block (a `more` kit scaled to
 * their length each frame by siteMotion).
 */
export function fallsGeometry(lod) {
  const out = bins();
  const n = lod === 2 ? 2 : 5;
  for (let k = 0; k < n; k++) {
    const x = (k - (n - 1) / 2) * 0.05;
    out.rope.push(tube([[x, 0, 0.02 * (k % 2 ? 1 : -1)], [x, -1, 0.02 * (k % 2 ? 1 : -1)]], 0.012, { radial: lod ? 3 : 4, segments: 1, around: 0.06 }));
  }
  return out;
}

/** A treadwheel crane in its own frame: the frame, the jib, the stays, the upper block; the wheel and load when still. */
function treadwheelCrane(c, lod, seed, out) {
  const { width, axleY } = TREAD;
  const h = Math.max(6, c.h || 10);
  const reach = craneReach(h);
  const head = [0, h, reach];
  const W = width / 2 + 0.35;
  // The base: two sills along the wheel's sides, cross sills front and back, on flat stones.
  for (const sx of [-1, 1]) out.wood.push(box(0.24, 0.22, 3.6, sx * W, 0, 0.2, 0.75));
  for (const z of [-1.5, 1.9]) out.wood.push(box(2 * W + 0.3, 0.2, 0.24, 0, 0.22, z, 0.75));
  // The trestles that carry the axle: on each side two raking posts up to a bearing block.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) out.wood.push(timber([sx * W, 0.2, sz * 1.25], [sx * W, axleY - 0.12, sz * 0.12], 0.17, 0.8));
    out.wood.push(box(0.26, 0.24, 0.42, sx * W, axleY - 0.24, 0, 0.7));
    if (lod < 2) out.wood.push(timber([sx * W, 1.1, -0.62], [sx * W, 1.1, 0.62], 0.12, 0.8));
  }
  // The jib: two legs from the base's front corners up to the head, leaning out over the load; cross
  // pieces between them, and the head's block.
  const feet = [[-W - 0.2, 0.2, 1.7], [W + 0.2, 0.2, 1.7]];
  for (const [k, f] of feet.entries()) out.poles.push(pole(f, [head[0] + (k ? 0.12 : -0.12), head[1] + 0.25, head[2]], 0.13, lod, seed + k));
  for (const t of lod === 2 ? [0.4] : [0.3, 0.55, 0.78]) {
    const y = 0.2 + (h - 0.2) * t;
    const z = 1.7 + (reach - 1.7) * t;
    const xw = (W + 0.2) * (1 - t) + 0.12 * t;
    out.wood.push(timber([-xw, y, z], [xw, y, z], 0.1, 0.85));
  }
  // The upper block of three sheaves under the head.
  out.wood.push(box(0.26, 0.5, 0.36, head[0], h - 0.55, head[2], 0.78));
  if (lod < 2) out.iron.push(box(0.05, 0.3, 0.05, head[0], h - 0.1, head[2], 0.7));
  // The back stays from the head to stakes behind, and a fore stay down to a stake ahead of the load.
  const stays = [[-2.4, -3.6], [2.4, -3.6]];
  for (const [sx, sz] of stays) {
    out.rope.push(rope([head[0], h + 0.15, head[2]], [sx, 0.35, sz], 0.022, lod, 0.08));
    out.wood.push(box(0.1, 0.45, 0.1, sx, 0, sz, 0.75));
  }
  // The lead rope from the drum beside the wheel up to the upper block.
  const dx = width / 2 + 0.4;
  out.rope.push(rope([dx, axleY + TREAD.drum, 0.02], [0.08, h - 0.6, reach - 0.12], 0.02, lod));
  // Still: the wheel at rest, the load on the ground under the jib, its falls slack down to it.
  if (!c.work) {
    const w = wheelGeometry(lod);
    for (const k of Object.keys(w)) for (const g of w[k]) out[k].push(g.translate(0, axleY, 0));
    const kind = c.load || 'marble';
    const l = loadGeometry(kind, lod);
    const ly = kind === 'timber' ? 0.02 : 0.12;
    for (const k of Object.keys(out)) if (l[k]) for (const g of l[k]) out[k].push(g.translate(0, ly, reach));
    const f = fallsGeometry(lod);
    const len = h - 0.55 - (ly + l.top);
    for (const g of f.rope) out.rope.push(g.scale(1, len, 1).translate(0, h - 0.55, reach));
    // Rollers under the block, as stones were moved about a site.
    if (kind !== 'timber') for (const z of [-0.25, 0.25]) out.wood.push(tintGeometry(boxUV(new CylinderGeometry(0.06, 0.06, 1.4, lod ? 5 : 8, 1).rotateZ(Math.PI / 2).translate(0, 0.06, reach + z)), () => 0.8));
  }
}

/** Shear legs in their own frame, as the engineer's post's (Vitruvius X.2.1), their load before them. */
export const SHEAR = Object.freeze({ feet: Object.freeze([[-0.85, -0.6], [0.85, -0.6]]), lean: 0.95 });

/** Where the shear legs' windlass turns (its roller's y and z, its ends, the crank's end at x1). */
export function shearWindlass(h) {
  const [fa, fb] = SHEAR.feet;
  const apex = [0, h, fa[1] + SHEAR.lean];
  const wy = WINDLASS.height;
  const t = wy / apex[1];
  const xa = fa[0] + (apex[0] - fa[0]) * t;
  const xb = fb[0] + (apex[0] - fb[0]) * t;
  const z = fa[1] + (apex[2] - fa[1]) * t;
  return { y: wy, z, x0: xa - 0.1, x1: xb + 0.1, apex };
}

function shearLegs(c, lod, seed, out) {
  const h = Math.max(3, c.h || 5);
  const w = shearWindlass(h);
  const A = w.apex;
  for (const [k, f] of SHEAR.feet.entries()) {
    const d = [A[0] - f[0], A[1], A[2] - f[1]];
    const len = Math.hypot(...d);
    out.poles.push(pole([f[0], 0, f[1]], [A[0] + (d[0] / len) * 0.25, A[1] + (d[1] / len) * 0.25, A[2] + (d[2] / len) * 0.25], 0.09, lod, seed + k));
    out.stone.push(slab(0.32, 0.06, 0.32, { bevel: 0.01, seed: seed + 5 + k, wobble: 0.004, tone: 0.06, grime: 0.4 }).translate(f[0], 0, f[1]));
  }
  if (lod < 2) for (let k = 0; k < 3; k++) {
    const t = new TorusGeometry(0.12, 0.02, 4, lod ? 10 : 16);
    t.rotateY(Math.PI / 2).rotateZ(0.2 * (k - 1)).translate(A[0], A[1] - 0.05 + k * 0.04, A[2]);
    out.rope.push(tintGeometry(boxUV(t), () => 0.85));
  }
  // The back stay to a stake, the block under the apex.
  const stake = [0, 0, -h * 0.75];
  out.rope.push(rope(A, [stake[0], 0.3, stake[2]], 0.014, lod, 0.06));
  out.wood.push(box(0.06, 0.35, 0.06, stake[0], 0, stake[2], 0.8));
  const py = A[1] - 0.4;
  out.wood.push(box(0.1, 0.28, 0.24, A[0], py - 0.14, A[2], 0.8));
  // The windlass between the legs, the rope wound on it, the crank at its right end (at rest, hanging,
  // when nobody works it: the winder brings his own, people/props.js crank).
  out.wood.push(tintGeometry(boxUV(new CylinderGeometry(0.06, 0.06, w.x1 - w.x0, lod ? 7 : 12, 1).rotateZ(Math.PI / 2).translate((w.x0 + w.x1) / 2, w.y, w.z)), () => 1));
  out.rope.push(tintGeometry(boxUV(new CylinderGeometry(0.085, 0.085, 0.3, lod ? 7 : 12, 1).rotateZ(Math.PI / 2).translate(0, w.y, w.z)), () => 0.9));
  if (!c.work) out.wood.push(box(0.04, WINDLASS.arm + 0.06, 0.05, w.x1 + 0.03, w.y - WINDLASS.arm - 0.03, w.z, 0.85));
  // The load: hoisted while it works, let down on rollers when still.
  const by = c.work ? 1.25 : 0.13;
  const kind = c.load || 'marble';
  const l = loadGeometry(kind === 'timber' ? 'timber' : kind, lod);
  for (const k of Object.keys(out)) if (l[k]) for (const g of l[k]) out[k].push(g.translate(A[0], by, A[2]));
  out.rope.push(rope([A[0], py - 0.3, A[2]], [A[0], by + l.top, A[2]], 0.012, lod));
  out.rope.push(rope([0, w.y + 0.08, w.z], [A[0], py - 0.02, A[2] - 0.075], 0.012, lod));
  if (!c.work && kind !== 'timber') for (const dz of [-0.2, 0.2]) out.wood.push(tintGeometry(boxUV(new CylinderGeometry(0.06, 0.06, 1.3, lod ? 5 : 8, 1).rotateZ(Math.PI / 2).translate(A[0], 0.06, A[2] + dz)), () => 0.8));
}

function crane(c, lod, seed, out) {
  const own = bins();
  if (c.kind === 'shear') shearLegs(c, lod, seed, own);
  else treadwheelCrane(c, lod, seed, own);
  moveInto(out, own, c.x || 0, c.z || 0, c.ry || 0);
}

// ---------------------------------------------------------------------------
// Centering
// ---------------------------------------------------------------------------

/** An arch's centering in its own frame: ribs across x every metre or so along z, the lagging over them, props under. */
function archCentering(c, lod, seed, out) {
  const span = Math.max(0.6, c.span);
  const rise = Math.max(0.15, Math.min(span / 2, c.rise ?? span / 2));
  const depth = Math.max(0.3, c.depth ?? 1);
  const y0 = c.y || 0;
  // The circle through both springings and the crown.
  const Rc = (span * span / 4 + rise * rise) / (2 * rise);
  const yc = y0 + rise - Rc;
  const a0 = Math.asin(Math.min(1, span / 2 / Rc));
  const n = lod === 0 ? 10 : lod === 1 ? 6 : 4;
  const pt = (i) => {
    const a = -a0 + (2 * a0 * i) / n;
    return [Math.sin(a) * Rc, yc + Math.cos(a) * Rc];
  };
  const ribs = Math.max(2, Math.round(depth / 1.1) + 1);
  const rz = (i) => -depth / 2 + 0.08 + ((depth - 0.16) * i) / (ribs - 1);
  const rw = 0.09;
  for (let r = 0; r < ribs; r++) {
    const z = rz(r);
    // The rib's curved top, a timber a facet, 0.12 under the lagging.
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pt(i);
      const [x2, y2] = pt(i + 1);
      const k = 0.88;
      out.wood.push(timber([x1 * k, yc + (y1 - yc) * k, z], [x2 * k, yc + (y2 - yc) * k, z], rw, 0.82, 0.16));
    }
    // The tie across the springing, the king post, the struts.
    if (lod < 2 || r === 0 || r === ribs - 1) {
      out.wood.push(timber([-span / 2 + 0.05, y0 - 0.1, z], [span / 2 - 0.05, y0 - 0.1, z], rw, 0.8, 0.14));
      if (rise > 0.5) {
        out.wood.push(timber([0, y0 - 0.05, z], [0, y0 + rise - 0.2, z], rw, 0.8));
        if (lod < 2) for (const s of [-1, 1]) out.wood.push(timber([0, y0 - 0.05, z], [s * span * 0.3, yc + Math.sqrt(Math.max(0, Rc * Rc - (span * 0.3) ** 2)) * 0.9 - 0.08 + (1 - 0.9) * yc, z], rw * 0.8, 0.8));
      }
    }
    // Props under the springings to the ground, on folding wedges.
    if (y0 > 0.3) {
      for (const s of [-1, 1]) {
        out.wood.push(timber([s * (span / 2 - 0.15), 0, z], [s * (span / 2 - 0.15), y0 - 0.17, z], 0.14, 0.75));
        if (lod === 0) out.wood.push(box(0.3, 0.06, 0.18, s * (span / 2 - 0.15), y0 - 0.23, z, 0.7));
      }
      if (span > 3) out.wood.push(timber([0, 0, z], [0, y0 - 0.15, z], 0.14, 0.75));
    }
  }
  // The lagging: boards along z across the ribs, following the curve (one strip a facet far out).
  const boards = lod === 0 ? n * 3 : n;
  for (let i = 0; i < boards; i++) {
    const a = -a0 + (2 * a0 * (i + 0.5)) / boards;
    const w = (2 * a0 * Rc) / boards - (lod === 0 ? 0.012 : 0);
    const g = new BoxGeometry(w, 0.04, depth);
    g.translate(0, Rc - 0.02, 0);
    g.rotateZ(-a);
    g.translate(0, yc, 0);
    out.wood.push(tintGeometry(boxUV(g), () => 0.86 + 0.1 * ((i * 0.618) % 1)));
  }
}

/** A dome's centering: ribs from the springing to the oculus's ring, rings between, a tower in the middle, the lagging. */
function domeCentering(c, lod, seed, out) {
  const r = Math.max(1, c.dome);
  const y0 = c.y || 0;
  const oculus = r * 0.2;
  const top = Math.acos(oculus / r);
  const ribs = lod === 0 ? 16 : lod === 1 ? 12 : 8;
  const n = lod === 0 ? 8 : lod === 1 ? 5 : 3;
  const lag = Math.max(0, Math.min(1, c.lag ?? 1));
  const sph = (az, el, k = 1) => [Math.cos(az) * Math.cos(el) * r * k, y0 + Math.sin(el) * r * k, Math.sin(az) * Math.cos(el) * r * k];
  for (let i = 0; i < ribs; i++) {
    const az = (i / ribs) * TAU;
    for (let j = 0; j < n; j++) out.wood.push(timber(sph(az, (top * j) / n, 0.96), sph(az, (top * (j + 1)) / n, 0.96), 0.12, 0.82, 0.2));
    // A raking prop from the tower's foot out to the rib's middle.
    if (lod < 2 && i % 2 === 0) out.wood.push(timber([Math.cos(az) * oculus * 0.8, y0, Math.sin(az) * oculus * 0.8], sph(az, top * 0.4, 0.94), 0.11, 0.75));
  }
  // Rings at a third and two thirds of the height, and the oculus's ring.
  for (const el of [top / 3, (2 * top) / 3, top]) {
    for (let i = 0; i < ribs; i++) out.wood.push(timber(sph((i / ribs) * TAU, el, 0.95), sph(((i + 1) / ribs) * TAU, el, 0.95), 0.1, 0.8));
  }
  // The tower under the oculus: four posts and their braces.
  const t = oculus * 0.75;
  const hy = y0 + Math.sin(top) * r * 0.95;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.wood.push(timber([sx * t, 0, sz * t], [sx * t, hy, sz * t], 0.16, 0.75));
  if (lod < 2) for (let y = 1.5; y < hy - 0.5; y += 2.5) for (const [a, b] of [[[-t, -t], [t, -t]], [[t, -t], [t, t]], [[t, t], [-t, t]], [[-t, t], [-t, -t]]]) out.wood.push(timber([a[0], y, a[1]], [b[0], y, b[1]], 0.1, 0.78));
  // Props down to the ground under the springing ring when the dome stands high on its drum.
  if (y0 > 0.3) for (let i = 0; i < ribs; i += 2) {
    const az = (i / ribs) * TAU;
    out.wood.push(timber([Math.cos(az) * r * 0.9, 0, Math.sin(az) * r * 0.9], [Math.cos(az) * r * 0.9, y0, Math.sin(az) * r * 0.9], 0.16, 0.72));
  }
  // The lagging: the dome's boarded skin, from the springing up `lag` of its height.
  if (lag > 0) {
    const elTop = top * lag;
    const rows = lod === 0 ? 14 : lod === 1 ? 8 : 4;
    const cols = lod === 0 ? 48 : lod === 1 ? 28 : 16;
    const pos = [];
    for (let j = 0; j < rows; j++) {
      const e1 = (elTop * j) / rows;
      const e2 = (elTop * (j + 1)) / rows;
      for (let i = 0; i < cols; i++) {
        const a1 = (i / cols) * TAU;
        const a2 = ((i + 1) / cols) * TAU;
        const p = [sph(a1, e1), sph(a2, e1), sph(a2, e2), sph(a1, e2)];
        pos.push(...p[0], ...p[2], ...p[1], ...p[0], ...p[3], ...p[2]);
      }
    }
    out.wood.push(shellGeometry(pos));
  }
}

/** A plain triangle soup (flat x, y, z triples) as a geometry with normals, metre UVs and a board tone by course. */
function shellGeometry(pos) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  boxUV(g);
  return tintGeometry(g, (x, y, z) => 0.8 + 0.12 * Math.sin(y * 9 + Math.atan2(z, x) * 3));
}

function centering(c, lod, seed, out) {
  const own = bins();
  if (c.dome) domeCentering(c, lod, seed, own);
  else archCentering(c, lod, seed, own);
  moveInto(out, own, c.x || 0, c.z || 0, c.ry || 0);
}

// ---------------------------------------------------------------------------
// Piles, the mortar pit, rubble
// ---------------------------------------------------------------------------

/** The most loads a pile shows. */
export const PILE_MAX = 9;

/** One load of a good, standing on y 0 at the origin, about 1 m square (see each). */
function loadOf(good, i, lod, seed, out) {
  const rnd = artRng(seed * 13 + i * 7 + 1);
  switch (good) {
    case 'marble': {
      // A block on two bearers; now and then a column drum instead.
      for (const z of [-0.28, 0.28]) out.wood.push(box(0.95, 0.08, 0.1, 0, 0, z, 0.7));
      if (i % 4 === 3) out.marble.push(revolve(profileOf([[0, 0], [0.38, 0], [0.38, 0.55], [0, 0.55]]), { segments: lod ? 10 : 22, metres: 1 }).translate(0, 0.08, 0));
      else out.marble.push(slab(0.9 + rnd() * 0.12, 0.5 + rnd() * 0.15, 0.62, { bevel: 0.015, seed: seed + i, wobble: 0.006, tone: 0.05, grime: 0.12 }).translate(0, 0.08, 0));
      break;
    }
    case 'timber': {
      // Squared beams in two crossed layers on bearers.
      out.wood.push(box(0.12, 0.1, 1.0, -0.4, 0, 0, 0.7), box(0.12, 0.1, 1.0, 0.4, 0, 0, 0.7));
      const layers = lod === 2 ? 1 : 2;
      for (let l = 0; l < layers; l++) for (let k = 0; k < 3; k++) {
        const along = l % 2 === 0;
        const off = (k - 1) * 0.3;
        const b = along ? box(1.05, 0.2, 0.22, 0, 0.1 + l * 0.2, off, 0.8 + 0.12 * rnd()) : box(0.22, 0.2, 1.0, off, 0.1 + l * 0.2, 0, 0.8 + 0.12 * rnd());
        out.wood.push(b);
      }
      break;
    }
    case 'clay': {
      // A pallet of square bricks in crossed courses, or of roof tiles stacked on edge.
      out.wood.push(box(0.8, 0.06, 0.8, 0, 0, 0, 0.72));
      if (i % 3 === 2) {
        const rows = lod === 0 ? 5 : 1;
        for (let r = 0; r < rows; r++) out.brick.push(box(0.7, 0.42, lod === 0 ? 0.12 : 0.66, 0, 0.06, lod === 0 ? -0.27 + r * 0.135 : 0, 0.95 - 0.04 * (r % 2)));
      } else if (lod === 0) {
        for (let cz = 0; cz < 7; cz++) for (let a = 0; a < 2; a++) {
          const crossed = cz % 2 === 1;
          const g = crossed ? box(0.34, 0.044, 0.68, -0.18 + a * 0.36, 0.06 + cz * 0.048, 0) : box(0.68, 0.044, 0.34, 0, 0.06 + cz * 0.048, -0.18 + a * 0.36);
          out.brick.push(tintGeometry(g, () => 0.85 + 0.15 * ((cz * 2 + a) * 0.618 % 1)));
        }
      } else out.brick.push(box(0.7, 0.34, 0.7, 0, 0.06, 0, 0.92));
      break;
    }
    case 'iron': {
      // Bars bound in bundles on a pallet, a bloom or two beside.
      out.wood.push(box(0.8, 0.06, 0.6, 0, 0, 0, 0.72));
      const bars = lod === 0 ? 9 : 3;
      for (let k = 0; k < bars; k++) out.iron.push(box(0.75, 0.035, 0.035, 0, 0.06 + Math.floor(k / 3) * 0.04, -0.06 + (k % 3) * 0.06, 0.75 + 0.2 * rnd()));
      if (lod < 2) for (let k = 0; k < 2; k++) {
        const b = new IcosahedronGeometry(0.11, 0);
        b.scale(1.2, 0.55, 1).translate(-0.2 + k * 0.4, 0.12, 0.22);
        out.iron.push(tintGeometry(boxUV(b), () => 0.6));
      }
      break;
    }
    default: {
      // Rough-dressed tufa blocks, as quarried.
      out.tufa.push(slab(0.75, 0.45, 0.55, { bevel: 0.03, seed: seed + i, wobble: 0.02, tone: 0.08, grime: 0.3 }));
    }
  }
}

/** Where load i of a pile stands: rows of three along x, the rows going back along z (the pile's own frame). */
function pileSpot(i) {
  return [((i % 3) - 1) * 1.15, Math.floor(i / 3) * 1.15];
}

function pile(p, lod, seed, out) {
  const n = Math.max(0, Math.min(PILE_MAX, Math.round(p.n || 0)));
  const own = bins();
  for (let i = 0; i < n; i++) {
    const one = bins();
    loadOf(p.good, i, lod, seed, one);
    const [x, z] = pileSpot(i);
    moveInto(own, one, x, z, 0.06 * Math.sin(i * 2.3 + seed));
  }
  moveInto(out, own, p.x || 0, p.z || 0, p.ry || 0);
}

/** A mortar pit: a plank-sided box sunk in the ground, slaked lime in it, a hoe; pozzolana heaped beside. */
function mortarPit(m, lod, seed, out) {
  const own = bins();
  for (const s of [-1, 1]) {
    own.wood.push(box(1.7, 0.26, 0.07, 0, 0, s * 0.55, 0.72));
    own.wood.push(box(0.07, 0.26, 1.1, s * 0.85, 0, 0, 0.72));
  }
  own.lime.push(box(1.62, 0.02, 1.02, 0, 0.18, 0, 0.95));
  if (lod < 2) own.wood.push(timber([0.2, 0.22, 0.1], [0.7, 0.75, 0.45], 0.03, 0.8));
  const heap = revolve(profileOf([[0, 0], [0.7, 0], [0.55, 0.12], [0.32, 0.3], [0.1, 0.4], [0, 0.41]]), {
    segments: lod === 0 ? 16 : lod === 1 ? 10 : 6, metres: 0.8,
    deform: (p, th) => { const k = 1 + 0.08 * Math.sin(th * 3 + seed) + 0.05 * Math.sin(th * 5); p.x *= k; p.z *= k; },
  });
  own.sand.push(heap.translate(1.65, 0, 0.1));
  moveInto(out, own, m.x || 0, m.z || 0, m.ry || 0);
}

/** Rubble raiders left: broken blocks and chips heaped over w x d. */
function rubbleHeap(r, lod, seed, out) {
  const own = bins();
  const rnd = artRng(seed * 17 + 3);
  const w = r.w || 2;
  const d = r.d || 2;
  const n = Math.round((lod === 0 ? 3 : lod === 1 ? 1.5 : 0.7) * w * d) + 2;
  for (let i = 0; i < n; i++) {
    const s = 0.15 + rnd() * 0.35;
    const g = new IcosahedronGeometry(s, 0);
    g.scale(1 + rnd() * 0.6, 0.55 + rnd() * 0.3, 1 + rnd() * 0.4);
    g.rotateY(rnd() * TAU);
    const x = (rnd() - 0.5) * (w - 2 * s);
    const z = (rnd() - 0.5) * (d - 2 * s);
    const hump = 1 - Math.min(1, Math.hypot(x / (w / 2), z / (d / 2)));
    g.translate(x, s * 0.3 + hump * 0.35, z);
    (i % 3 === 0 ? own.marble : own.rubble).push(tintGeometry(boxUV(g), () => 0.75 + rnd() * 0.25));
  }
  moveInto(out, own, r.x || 0, r.z || 0, r.ry || 0);
}

// ---------------------------------------------------------------------------
// Materials and the parts
// ---------------------------------------------------------------------------

/** The site's materials, shared by key with the engineer's post's and the look's other models. */
export function siteMaterials() {
  return {
    poles: material('bark', { surface: 'bark', vertexColors: true, snow: 0.6 }),
    wood: material('wood', { surface: 'wood', vertexColors: true, snow: 1 }),
    rope: material('rope', { surface: 'rope', vertexColors: true, snow: 0.6, normal: 1 }),
    iron: material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }),
    marble: material('marble', { surface: 'marble', vertexColors: true, snow: 1 }),
    brick: material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 0.8 }),
    stone: material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 }),
    tufa: material('tufa', { surface: 'tufa', vertexColors: true, snow: 1 }),
    lime: material('slaked-lime', { color: 0xe9e5da, roughness: 0.95, vertexColors: true, snow: 0.6 }),
    sand: material('pozzolana', { surface: 'earth', color: 0xb0745a, vertexColors: true, snow: 1 }),
    rubble: material('rubble-wall', { surface: 'rubble', vertexColors: true, snow: 1 }),
    earth: material('beaten-earth', { surface: 'earth', vertexColors: true, snow: 1 }),
  };
}

/** Parts that cast no shadow (flat in a pit, or too thin to show one). */
const NO_CAST = new Set(['lime']);

/** The site's geometry by material (fresh: the caller owns it). */
function buildBins(site, lod) {
  const out = bins();
  let seed = 11;
  for (const s of site.scaffolds || []) scaffold(s, lod, seed++, out);
  for (const c of site.cranes || []) crane(c, lod, (seed += 3), out);
  for (const c of site.centering || []) centering(c, lod, seed++, out);
  for (const p of site.piles || []) pile(p, lod, seed++, out);
  for (const m of site.mortar || []) mortarPit(m, lod, seed++, out);
  for (const r of site.rubble || []) rubbleHeap(r, lod, seed++, out);
  return out;
}

/** What of a site its geometry follows (not its crew): the key of its cache. */
export function siteKey(site, lod) {
  if (!site) return `${lod}|`;
  const { scaffolds, cranes, centering: ce, piles, mortar, rubble } = site;
  return `${lod}|${JSON.stringify([scaffolds || [], cranes || [], ce || [], piles || [], mortar || [], rubble || []])}`;
}

/** The parts made so far, by siteKey: [{ geometry, material, name, cast }], merged a material. */
const CACHE = new Map();
/** How many sites' parts are kept: a city has one monument, a lab a few dozen stages. */
const CACHE_MAX = 96;

/** The cached parts of a site at a level (made the first time). */
function cachedParts(site, lod) {
  const key = siteKey(site, lod);
  let parts = CACHE.get(key);
  if (parts) {
    // (Most recently used last, so the oldest goes first when the cache is full.)
    CACHE.delete(key);
    CACHE.set(key, parts);
    return parts;
  }
  const out = buildBins(site || {}, lod);
  const mats = siteMaterials();
  const p = new TaggedParts('site');
  for (const k of Object.keys(out)) if (out[k].length) p.add(`site-${k}`, mats[k], out[k], { cast: !NO_CAST.has(k) });
  parts = p.build().meshes.map((m) => ({ geometry: m.geometry, material: m.material, name: m.name, cast: m.castShadow }));
  if (CACHE.size >= CACHE_MAX) {
    const [oldKey, old] = CACHE.entries().next().value;
    CACHE.delete(oldKey);
    for (const o of old) o.geometry.dispose();
  }
  CACHE.set(key, parts);
  return parts;
}

/**
 * A monument stage's site dressing at a level of detail (0 to 2): one entry
 * a material, { g, material, name, cast }, each `g` a fresh copy the caller
 * owns (TaggedParts.add then build() merges and frees it). Cached by the
 * site's content and the level, so a stage's kit built at every level, or
 * built again, makes its site once. An empty or missing site gives [].
 */
export function siteParts(site, lod = 0) {
  lod = Math.max(0, Math.min(2, lod | 0));
  return cachedParts(site, lod).map((p) => ({ g: p.geometry.clone(), material: p.material, name: p.name, cast: p.cast }));
}

/** Add a site's parts to a model's TaggedParts (a convenience for the monuments' builders), in state `when`. */
export function addSite(parts, site, lod, when = 'always') {
  for (const e of siteParts(site, lod)) parts.add(e.name, e.material, [e.g], { when, cast: e.cast });
  return parts;
}

/** The site alone as a Group (the lab, the tests, MODEL_PARTS' `site:` kits). */
export function siteGroup(site, lod = 0) {
  const p = new TaggedParts('site');
  addSite(p, site, lod);
  return p.build().group;
}

// ---------------------------------------------------------------------------
// What moves: the treadwheel's turn and its load (siteMotion), as `more` kits
// ---------------------------------------------------------------------------

/** The kits that move: built by their key (models.js MODEL_PARTS `site`). */
export function buildSitePart(key, lod) {
  const [, what, kind] = key.split(':');
  const p = new TaggedParts(`site-${what}`);
  const mats = siteMaterials();
  const add = (b) => { for (const k of Object.keys(mats)) if (b[k] && b[k].length) p.add(`site-${k}`, mats[k], b[k]); };
  if (what === 'wheel') add(wheelGeometry(lod));
  else if (what === 'load') add(loadGeometry(kind || 'marble', lod));
  else if (what === 'falls') add(fallsGeometry(lod));
  else throw new Error(`Unknown site part: ${key}`);
  return p.build().group;
}

const _m = new Matrix4();
const _c = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();

/** Entries kept per site object (their matrices refilled each frame). */
const MOTION = new WeakMap();

/**
 * The moving parts of a site's working treadwheel cranes at time t (s, the
 * look's clock): `more` entries ({ key, n, mats, state }) in the model's
 * metres, refilled in place each call (kept per site object, so a frame
 * allocates nothing): the wheel turning at its treaders' pace, the load
 * rising on its falls from the ground to under the jib's head, set off at
 * the top (shrunk away in a moment) and the next one taken up from the
 * ground. Cranes not at `work` are drawn whole by siteParts instead.
 */
export function siteMotion(site, t = 0) {
  const cranes = ((site && site.cranes) || []).filter((c) => c.work && c.kind !== 'shear');
  if (!cranes.length) return [];
  let e = MOTION.get(site);
  if (!e) {
    const loads = [...new Set(cranes.map((c) => c.load || 'marble'))];
    const n = cranes.length;
    e = {
      wheel: { key: 'site:wheel', n, mats: new Float32Array(16 * n), state: 'always' },
      falls: { key: 'site:falls', n, mats: new Float32Array(16 * n), state: 'always' },
      loads: Object.fromEntries(loads.map((l) => [l, { key: `site:load:${l}`, n: 0, mats: new Float32Array(16 * n), state: 'always' }])),
    };
    e.list = [e.wheel, e.falls, ...Object.values(e.loads)];
    MOTION.set(site, e);
  }
  for (const l of Object.values(e.loads)) l.n = 0;
  cranes.forEach((c, i) => {
    const h = Math.max(6, c.h || 10);
    const reach = craneReach(h);
    const cyc = liftCycle(h);
    const kind = c.load || 'marble';
    // Each crane its own phase (from where it stands), so two never lift in step.
    const ph = (((c.x || 0) * 0.37 + (c.z || 0) * 0.61) % 1 + 1) % 1;
    const u = ((t / cyc.period + ph) % 1 + 1) % 1;
    const riseU = cyc.rise / cyc.period;
    const shrink = 1.2 / cyc.period;
    let y = 0.02;
    let s = 1;
    if (u < riseU) y = 0.02 + cyc.climb * (u / riseU);
    else if (u < riseU + shrink) { y = 0.02 + cyc.climb; s = 1 - (u - riseU) / shrink; }
    else { s = Math.min(1, Math.max(0, (u - riseU - shrink) / (1 - riseU - shrink) * 3 - 2)); }
    s = Math.max(1e-3, s);
    // The crane's own frame in the model's.
    _c.makeRotationY(c.ry || 0).setPosition(c.x || 0, 0, c.z || 0);
    // The wheel turns steadily with the men in it (their feet move back as the floor does).
    const a = -(t * TREAD.pace) / TREAD.floor;
    _q.setFromEuler(_e.set(a, 0, 0));
    _m.compose(_p.set(0, TREAD.axleY, 0), _q, _s.set(1, 1, 1));
    _m.premultiply(_c).toArray(e.wheel.mats, i * 16);
    // The load and its lower block, and the falls from the upper block down to it.
    const sway = 0.03 * Math.sin(t * 0.9 + i);
    _q.setFromEuler(_e.set(sway * 0.3, 0, sway));
    _m.compose(_p.set(0, y, reach), _q, _s.set(s, s, s));
    const l = e.loads[kind];
    _m.premultiply(_c).toArray(l.mats, l.n++ * 16);
    const len = Math.max(0.05, h - 0.55 - (y + loadTop(kind) * s));
    _m.compose(_p.set(0, h - 0.55, reach), _q.identity(), _s.set(s, len, s));
    _m.premultiply(_c).toArray(e.falls.mats, i * 16);
  });
  return e.list;
}

// ---------------------------------------------------------------------------
// The crew
// ---------------------------------------------------------------------------

/** A builder's working clothes: a short tunic of undyed or brown wool, an apron's leather. */
const WORKER = Object.freeze({ body: 'm', dress: ['tunic:short'], hair: 'crop' });
const TUNICS = Object.freeze([0xa8977a, 0x8a7a5a, 0x6e604f, 0xbfae8e, 0x9a8668, 0xd6cab0]);

/** A mason dressing a block before him (hammer and chisel), at [x, y, z] facing ry. */
export function crewMason(at, ry, seed) {
  return { ...WORKER, clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at, ry, seed, colours: { tunic: TUNICS[seed % TUNICS.length] } };
}

/** A carrier walking `length` metres ahead and back with a load: 'plank' (a timber on the shoulder), 'basket' (bricks or lime on the head), 'sack'. */
export function crewCarrier(at, ry, length, seed, load = 'basket') {
  const r = { length, speed: 0.9, pauseEnd: 2.5, pauseStart: 2, clipEnd: 'idle', clipStart: 'idle' };
  const tunic = { tunic: TUNICS[(seed + 2) % TUNICS.length] };
  if (load === 'plank') return { ...WORKER, clip: 'haul', props: { L: 'wprop:plank' }, at, ry, seed, route: { ...r, speed: 1.1 }, colours: tunic };
  if (load === 'sack') return { ...WORKER, clip: 'carry', props: { L: 'sack' }, at, ry, seed, route: r, colours: tunic };
  return { ...WORKER, clip: 'headCarry', props: { L: 'wprop:basket' }, at, ry, seed, route: r, colours: { ...tunic, accent: 0xb85a3a } };
}

/** A labourer mixing mortar with a hoe (the hoe's blade before him). */
export function crewMixer(at, ry, seed) {
  return { ...WORKER, clip: 'hoe', props: { R: 'hoe' }, at, ry, seed, colours: { tunic: TUNICS[(seed + 4) % TUNICS.length] } };
}

/** The foreman (the redemptor's man) with his tablet, watching the work. */
export function crewForeman(at, ry, seed) {
  return { body: 'm', dress: ['tunic:knee', 'paenula'], hair: 'crop', beard: 'short', clip: 'hold', props: { R: 'tablet' }, at, ry, seed, old: true, colours: { tunic: 0xd8cdb4, mantle: 0x8a6a4a } };
}

/**
 * The men every working crane needs, in the site's metres: a treader in
 * each turning wheel (walking in place at the floor's pace, his hands on the
 * spokes: the clip 'tread'), a man at the load's tag line under the jib;
 * at shear legs, the winder at the windlass's crank.
 */
export function craneCrew(c, seed = 1) {
  if (!c.work) return [];
  const x = c.x || 0;
  const z = c.z || 0;
  const ry = c.ry || 0;
  const cs = Math.cos(ry);
  const sn = Math.sin(ry);
  // A point of the crane's frame in the site's.
  const at = (lx, ly, lz) => [x + lx * cs + lz * sn, ly, z - lx * sn + lz * cs];
  if (c.kind === 'shear') {
    const w = shearWindlass(Math.max(3, c.h || 5));
    // Facing -z of the legs' frame, the crank's axle WINDLASS.ahead before him (engineer.js's winder).
    return [{ ...WORKER, clip: 'windlass', props: { R: 'crank' }, at: at(w.x1 + WINDLASS.x + 0.06, 0, w.z + WINDLASS.ahead), ry: ry + Math.PI, seed, colours: { tunic: TUNICS[seed % TUNICS.length] } }];
  }
  const h = Math.max(6, c.h || 10);
  const reach = craneReach(h);
  return [
    // In the wheel at its lowest point, facing +z: as the floor moves back under him the wheel turns.
    { ...WORKER, clip: 'tread', at: at(0, TREAD.axleY - TREAD.floor + 0.03, 0.1), ry, seed, speed: TREAD_SPEED, colours: { tunic: TUNICS[seed % TUNICS.length] } },
    // The tag line's man, steadying the load from the side.
    { ...WORKER, clip: 'hold', at: at(1.6, 0, reach + 0.8), ry: ry - Math.PI * 0.6, seed: seed + 1, colours: { tunic: TUNICS[(seed + 1) % TUNICS.length] } },
  ];
}

/** Every actor of a site: its crew as given, and the men its working cranes need. */
export function siteActors(site) {
  if (!site) return [];
  const out = [...(site.crew || [])];
  (site.cranes || []).forEach((c, i) => out.push(...craneCrew(c, 300 + i * 7)));
  return out;
}

/** A site's lamps at night: none of its own (a camp's braziers and a monument's lamps are their models'). */
export const SITE_LAMPS = Object.freeze([]);

// ---------------------------------------------------------------------------
// The stage view: what the sim says a monument shows (read only)
// ---------------------------------------------------------------------------

/** Steps of a stage's own rise a kit is built for: a stage's part stands 0, 1/4, 2/4 or 3/4 of its height. */
export const RISE_STEPS = 4;

/** The camps' crews on each site this tick (site id -> crews), read once a tick per game. */
const CREWS = new WeakMap();
function crewsOn(game) {
  const tick = game.time ? game.time.totalTicks : 0;
  let c = CREWS.get(game);
  if (c && c.tick === tick) return c.on;
  const on = new Map();
  if (game.buildings) {
    for (const b of game.buildings.values()) {
      const cr = b && b.camp && b.camp.crew;
      if (cr && cr.state === 'site' && cr.site) on.set(cr.site, (on.get(cr.site) || 0) + 1);
    }
  }
  CREWS.set(game, { tick, on });
  return on;
}

/**
 * A monument's look from the sim's fields (a site's b.mon, data/monuments.js
 * stages): the stage being built (0-based; the number of stages when
 * finished), how far its own part has risen (`step` of RISE_STEPS, from the
 * work done over the stage's work), the loads of each good delivered and not
 * yet built in (`stock`: delivered less the share the work has used, in the
 * camp's cart loads, at most PILE_MAX), whether a camp's crew is on it
 * (`crew`: a camp's crew in state 'site' there, the sim's own record, and
 * not halted), `halted` (the player stopped it), `struck` (raiders set it
 * back in the raid now on: sim/monuments.js monumentSpent's test) and, once
 * finished, `sacked` and `open` (sim/monumentEffects.js closedReason).
 * A ghost (no id) or a monument without its state shows stage 0, empty.
 * `sig` is a short string of all of it, for caching a look by.
 */
export function siteView(b, game) {
  const t = b && b.def ? MONUMENT_TYPES[b.def.mon] : null;
  const load = CAMP.load;
  const m = b && b.mon;
  const stages = t ? t.stages.length : 4;
  const stage = m ? Math.max(0, Math.min(stages, m.stage | 0)) : 0;
  const finished = !!m && stage >= stages;
  const v = { stage, stages, finished, step: 0, progress: 0, stock: {}, crew: false, halted: false, struck: false, sacked: false, open: false };
  if (!m || !t) return withSig(v);
  if (finished) {
    v.sacked = !!m.sacked;
    v.open = closedReason(b) === null;
    return withSig(v);
  }
  const st = t.stages[stage];
  v.progress = st.work > 0 ? Math.max(0, Math.min(1, (m.work || 0) / st.work)) : 0;
  v.step = Math.min(RISE_STEPS - 1, Math.floor(v.progress * RISE_STEPS + 1e-9));
  for (const [good, need] of Object.entries(st.goods)) {
    const onSite = Math.max(0, (m.got[good] || 0) - need * v.progress);
    const n = Math.min(PILE_MAX, Math.ceil(onSite / load - 1e-6));
    if (n > 0) v.stock[good] = n;
  }
  v.halted = !!m.halted;
  v.struck = !!(game && game.time && game.military && m.setbackRaid != null && m.setbackRaid === raidKey(game));
  v.crew = !v.halted && !!(game && b.id != null && crewsOn(game).get(b.id));
  return withSig(v);
}

function withSig(v) {
  const stock = Object.keys(v.stock).sort().map((g) => `${g}${v.stock[g]}`).join(',');
  v.sig = `${v.stage}.${v.step}|${stock}|${v.crew ? 'c' : ''}${v.halted ? 'h' : ''}${v.struck ? 'x' : ''}${v.sacked ? 's' : ''}${v.open ? 'o' : ''}`;
  return v;
}
