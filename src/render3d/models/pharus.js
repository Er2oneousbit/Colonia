/**
 * models/pharus.js
 * ----------------------------------------------------------------------------
 * The Lighthouse (pharus) of the 3D look on its 3 x 3 waterside footprint
 * (12 m), from the record rather than the 2D sprite:
 *
 *   - The Pharos of Alexandria as its coins and the mosaics draw it, and
 *     the lighthouse Claudius built at Ostia's harbour as the Torlonia
 *     relief and Nero's coins show it: a tower in diminishing tiers, a
 *     square storey, an eight-sided one, a round lantern on top with the
 *     fire, a statue crowning it (Poseidon's, or the emperor's).
 *   - The Tower of Hercules at A Coruna, the one still at work: a square
 *     Roman tower whose outer ramp wound round it (the band of its traces
 *     on the core), up which the fuel went; the Dover pharos, an octagon of
 *     stone with courses of tile, stepping in as it rose.
 *   - Its fire: a timber blaze on a hearth at the top, burning all night
 *     and smoking by day (Pliny XXXVI.83 warns that seen from afar it could
 *     be taken for a star); a bronze mirror behind it, the tradition says,
 *     threw its light out to sea.
 *
 * In 12 m, built as the game places a 3 x 3 waterside building (as the
 * fleet's: models/harbour.js HARBOUR, facing +z, the land row behind the
 * shore line, the two front rows out over the water whose surface is
 * y = 0): a quay on the land row with the keeper's lodge and the timber
 * store under a lean-to; a platform of opus pilarum out over the water,
 * its arches letting the sea through, a cutwater at its end; on it the
 * tower: a battered square storey of squared limestone with courses of
 * tile, slit windows and a ramp winding round it twice; an eight-sided
 * storey; the round lantern of eight columns under a bronze cupola with
 * the god's statue, the blaze inside before its bronze reflector.
 *
 * Built in four stages (data/monuments.js pharus): the piers in their
 * cofferdam of piles (0), the square storey (1), the eight-sided storey (2),
 * the lantern and the first fire (3): read as a timeline `t` from 0 to 4.
 *
 * States (models.js partShows tags): 'open' (lit: staffed and the store
 * holding timber: the blaze, its embers, the lodge's door open), 'shut'
 * (dark: cold ash on the hearth, the door shut).
 *
 * Metres, the footprint's middle at the origin, y up, the water toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { boxUV, tintGeometry, revolve, profileOf, tube } from '../shapes.js';
import { material, iceMaterial } from '../materials.js';
import { slab, paving, TaggedParts } from './masonry.js';
import { gableRoof, leanTo, woodpile } from './rural.js';
import { box, rake, gableTri } from './domus.js';
import { HARBOUR, harbourMaterials, arcade, ashlar, bollard, mooringRing, waterSteps, pile, pierFoam } from './harbour.js';
import { hearthFire } from './sacra.js';
import { trident } from './numina.js';
import { DYES } from '../people/actors.js';

/** The lighthouse's measures (metres): the game, the lab and the tests read them. */
export const PHARUS = Object.freeze({
  /** The quay's and the platform's top. */
  top: 0.86,
  /** The platform out over the water: x half width, from z0 to z1. */
  platform: Object.freeze({ hw: 4.3, z0: -2.3, z1: 5.85 }),
  /** The tower's middle (x, z). */
  at: Object.freeze([0, 1.75]),
  /** The square storey: half width at its foot and its top, its top's y. */
  square: Object.freeze({ foot: 2.75, head: 2.45, top: 8.0 }),
  /** The eight-sided storey: its radius (to a face) and its top. */
  oct: Object.freeze({ r: 1.85, top: 11.9 }),
  /** The lantern: its floor, the columns' ring and height, the cupola's top. */
  lantern: Object.freeze({ floor: 12.1, r: 1.25, colH: 2.1, top: 15.4 }),
  /** The fire on its hearth in the lantern (x, y, z in the model): the night's glow. */
  fire: Object.freeze([0, 12.75, 1.75]),
  /** The keeper's lodge and the timber store on the quay: [x0, x1, z0, z1]. */
  lodge: Object.freeze([-5.55, -2.5, -5.6, -3.35]),
  store: Object.freeze([2.3, 5.6, -5.55, -3.65]),
});

const H = PHARUS;
const [TX, TZ] = H.at;

/** When each part is built on the timeline (stage units): [start, end]. */
export const PHARUS_TIMES = Object.freeze({
  piles: [0, 0.35],
  piers: [0.2, 1.0],
  quay: [0.5, 1.0],
  square: [1.0, 2.0],
  ramp: [1.4, 2.0],
  oct: [2.0, 2.9],
  lantern: [3.0, 3.6],
  cupola: [3.5, 3.85],
  fire: [3.85, 4.0],
});

export function hgrow(t, k) {
  const [a, b] = PHARUS_TIMES[k];
  return Math.max(0, Math.min(1, (t - a) / (b - a)));
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** The quay along the land row: ashlar faces, flags on top, steps up from the street; the lodge and the store. */
function quay(out, t, lod, seed) {
  const g = hgrow(t, 'quay');
  if (g <= 0) return;
  const half = HARBOUR.half - 0.02;
  const top = H.top * g;
  const z0 = -half;
  const z1 = HARBOUR.shore;
  // The back face, open in the middle for the steps up from the street.
  out.stone.push(...ashlar(-half, -0.95, 0, top, z0, z0 + 0.45, { seed, lod }));
  out.stone.push(...ashlar(0.95, half, 0, top, z0, z0 + 0.45, { seed: seed + 3, lod }));
  for (const [x0, x1] of [[-half, -half + 0.45], [half - 0.45, half]]) out.stone.push(...ashlar(x0, x1, 0, top, z0 + 0.45, z1, { seed: seed + x0, lod }));
  out.stone.push(slab(2 * half - 0.9, Math.max(0.02, top - 0.04), z1 - z0 - 0.45, { bevel: 0.01, seed: seed + 5, wobble: 0, tone: 0, grime: 0 }).translate(0, 0, (z0 + 0.45 + z1) / 2));
  if (g < 1) return;
  out.flags.push(...paving(-half, half, z0, z1 + 0.1, top, seed + 20, { rowW: 0.6, minL: 0.5, maxL: 1.0, lod }));
  // Steps up from the street at the back, in the middle: each block from the foot to its tread, back to the quay.
  for (let k = 0; k < 3; k++) out.stone.push(slab(1.9, ((k + 1) * top) / 3, 0.9 - k * 0.3, { bevel: 0.015, seed: seed + 30 + k, wobble: 0, tone: 0.05, grime: 0.3 }).translate(0, 0, z0 + k * 0.3 + (0.9 - k * 0.3) / 2));
}

/** The keeper's lodge (stone, a tiled gable, its door) and the timber store's lean-to, once the quay stands. */
function lodge(out, t, lod, seed) {
  if (hgrow(t, 'quay') < 1) return;
  const [x0, x1, z0, z1] = H.lodge;
  const y0 = H.top;
  out.stone.push(...ashlar(x0, x1, y0, y0 + 2.2, z0, z0 + 0.35, { seed: seed + 1, lod }));
  out.stone.push(...ashlar(x0, x0 + 0.35, y0, y0 + 2.2, z0 + 0.35, z1, { seed: seed + 2, lod }));
  out.stone.push(...ashlar(x1 - 0.35, x1, y0, y0 + 2.2, z0 + 0.35, z1, { seed: seed + 3, lod }));
  // The front with its door (toward the tower).
  out.stone.push(...ashlar(x0 + 0.35, -4.45, y0, y0 + 2.2, z1 - 0.35, z1, { seed: seed + 4, lod }));
  out.stone.push(...ashlar(-3.55, x1 - 0.35, y0, y0 + 2.2, z1 - 0.35, z1, { seed: seed + 5, lod }));
  out.stone.push(slab(0.9, 0.5, 0.35, { bevel: 0.01, seed: seed + 6, wobble: 0, tone: 0, grime: 0 }).translate(-4.0, y0 + 1.7, z1 - 0.175));
  out.dark.push(box(0.9, 1.7, 0.04, -4.0, y0, z1 - 0.3));
  const r = gableRoof({ x0: x0 - 0.05, x1: x1 + 0.05, z0: z0 - 0.05, z1: z1 + 0.05, eaveY: y0 + 2.2, along: 'x', lod, seed: seed + 7, over: 0.3, gableOver: 0.2 });
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  // Its gable ends, stone up under the roof's ends.
  // (A triangle built across x in a plane of z, turned a quarter onto x: its thickness then runs from x to x + 0.35.)
  for (const x of [x0, x1 - 0.35]) {
    const g = gableTri(z0 + 0.02, z1 - 0.02, 0, 0.35, y0 + 2.2, r.ridgeY - 0.04);
    g.rotateY(-Math.PI / 2);
    out.stone.push(g.translate(x, 0, 0));
  }
  // The store: a lean-to of tiles on posts against the quay's back wall.
  const [sx0, sx1, sz0, sz1] = H.store;
  for (const x of [sx0 + 0.1, (sx0 + sx1) / 2, sx1 - 0.1]) out.wood.push(box(0.14, 2.0, 0.14, x, y0, sz1 - 0.1, 0.75));
  out.wood.push(box(sx1 - sx0, 0.16, 0.16, (sx0 + sx1) / 2, y0 + 2.0, sz1 - 0.1, 0.7));
  out.stone.push(...ashlar(sx0, sx1, y0, y0 + 2.6, sz0, sz0 + 0.3, { seed: seed + 9, lod }));
  // (Built facing +z from its wall at z = 0: set against the store's back wall.)
  const lt = leanTo({ L: sx1 - sx0 + 0.3, span: sz1 - sz0 - 0.2, topY: y0 + 2.65, eaveY: y0 + 2.12, lod, seed: seed + 10, over: 0.25 });
  for (const geo of lt.tile) out.tile.push(geo.translate((sx0 + sx1) / 2, 0, sz0 + 0.3));
  for (const geo of lt.wood) out.wood.push(geo.translate((sx0 + sx1) / 2, 0, sz0 + 0.3));
}

/** The platform out over the water: the cofferdam's piles first, then the piers and arches, the flags, the cutwater. */
function platform(out, t, lod, seed, ice) {
  const P = H.platform;
  const pl = hgrow(t, 'piles');
  const pr = hgrow(t, 'piers');
  // The cofferdam: a ring of driven piles round where the piers go, pulled once the piers stand.
  if (pl > 0 && pr < 1) {
    const n = Math.round(30 * pl);
    const ring = [];
    for (let x = -P.hw - 0.3; x <= P.hw + 0.31; x += 0.6) ring.push([x, P.z1 - 0.05]);
    for (let z = HARBOUR.shore; z <= P.z1; z += 0.6) {
      ring.push([-P.hw - 0.3, z]);
      ring.push([P.hw + 0.3, z]);
    }
    ring.slice(0, Math.max(n, Math.round(ring.length * pl))).forEach(([x, z], i) => out.wood.push(pile(x, z, 1.1 + (i % 3) * 0.08, { r: 0.1, seed: seed + i, lod })));
    // The water pumped out inside: a dark muddy floor where the sea was.
    if (lod < 2) out.mud.push(box(2 * P.hw + 0.4, 0.02, P.z1 - HARBOUR.shore + 0.3, 0, 0.0, (P.z1 + HARBOUR.shore) / 2, 0.6));
  }
  if (pr <= 0) return;
  const top = H.top;
  const h = -0.5 + (top + 0.5) * pr;
  // The piers and their arches along both sides, and across the end.
  if (pr >= 1) {
    for (const s of [-1, 1]) {
      const a = arcade(HARBOUR.shore, P.z1 - 0.5, s * (P.hw - 0.45), 0.9, top, { along: 'z', span: 0.9, pier: 0.8, seed: seed + 40 + s, lod, kerb: true });
      out.tufa.push(...a.tufa);
      out.brick.push(...a.brick);
      out.stone.push(...a.trav);
    }
    out.stone.push(...ashlar(-P.hw, P.hw, -0.5, top, P.z1 - 0.5, P.z1, { seed: seed + 50, lod, course: 0.34 }));
    // The fill under the flags, the flags, bollards and rings, steps down to the water on the right.
    out.stone.push(slab(2 * P.hw - 1.8, top - 0.02, P.z1 - 0.5 - HARBOUR.shore, { bevel: 0.01, seed: seed + 51, wobble: 0, tone: 0, grime: 0 }).translate(0, 0, (P.z1 - 0.5 + HARBOUR.shore) / 2));
    out.flags.push(...paving(-P.hw, P.hw, HARBOUR.shore, P.z1, top, seed + 52, { rowW: 0.62, minL: 0.5, maxL: 1.0, lod }));
    if (lod < 2) {
      for (const [x, z] of [[-P.hw + 0.35, P.z1 - 0.4], [P.hw - 0.35, P.z1 - 0.4], [-P.hw + 0.35, 2.4]]) out.stone.push(bollard(x, top, z, lod));
      for (const z of [0.6, 3.2]) for (const s of [-1, 1]) out.iron.push(mooringRing(s * P.hw, top - 0.16, z, s, lod, true));
      for (const g of waterSteps(1.0, top, 4, 0.3, seed + 60, lod)) out.stone.push(g.rotateY(-Math.PI / 2).translate(P.hw, 0, 3.9));
      if (!ice) out.foam.push(pierFoam(-P.hw, P.hw, HARBOUR.shore + 0.1, P.z1, 0.45, seed + 70, lod));
    }
  } else {
    // The piers rising inside the cofferdam: blocks of concrete faced in tufa, out of the drained floor.
    for (const s of [-1, 1]) for (let z = HARBOUR.shore + 0.4; z < P.z1; z += 1.7) out.tufa.push(box(0.9, h + 0.5, 0.8, s * (P.hw - 0.45), -0.5, z, 0.85));
    out.tufa.push(box(2 * P.hw, h + 0.5, 0.5, 0, -0.5, P.z1 - 0.25, 0.85));
  }
}

/** A tier's wall courses: squared limestone between courses of tile, every `band` metres. */
function courses(out, y0, y1, band, push) {
  let y = y0;
  let k = 0;
  while (y < y1 - 0.02) {
    const yb = Math.min(y1, y + band);
    push(y, yb - (yb < y1 ? 0.12 : 0), k, 'stone');
    if (yb < y1) push(yb - 0.12, yb, k, 'brick');
    y = yb;
    k++;
  }
}

/** The square storey up to its height at `t`: battered, coursed, its windows, the door; the ramp winding round it. */
function squareStorey(out, t, lod, seed) {
  const g = hgrow(t, 'square');
  if (g <= 0) return;
  const S = H.square;
  const y0 = H.top;
  const yTop = y0 + (S.top - y0) * g;
  const half = (y) => S.foot + (S.head - S.foot) * ((y - y0) / (S.top - y0));
  // Each course a frustum of four faces (a box narrowing upward): a slab tapered by scaling its top.
  const frustum = (ya, yb, k, kind) => {
    const ha = half(ya);
    const hb = half(yb);
    const geo = new BoxGeometry(2 * ha, yb - ya, 2 * ha);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const top = p.getY(i) > 0;
      if (top) { p.setX(i, p.getX(i) * (hb / ha)); p.setZ(i, p.getZ(i) * (hb / ha)); }
    }
    geo.computeVertexNormals();
    geo.translate(TX, ya + (yb - ya) / 2, TZ);
    const tone = kind === 'brick' ? 0.85 + (k % 3) * 0.05 : 0.9 + ((k * 37) % 5) * 0.02;
    (kind === 'brick' ? out.brick : out.ashlar).push(tintGeometry(boxUV(geo), () => tone));
  };
  courses(out, y0, yTop, 1.15, frustum);
  // The plinth round its foot.
  out.stone.push(slab(2 * S.foot + 0.4, 0.3, 2 * S.foot + 0.4, { bevel: 0.03, seed: seed + 1, wobble: 0, tone: 0.03, grime: 0.35 }).translate(TX, y0, TZ));
  if (lod < 2) {
    // Slit windows on each face, three storeys of them, and the door at the foot toward the land.
    for (const wy of [2.6, 4.6, 6.6]) {
      if (yTop < y0 + wy + 0.5) continue;
      const hw = half(y0 + wy) + 0.006;
      for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const geo = dx ? new BoxGeometry(0.02, 0.62, 0.16) : new BoxGeometry(0.16, 0.62, 0.02);
        geo.translate(TX + dx * hw, y0 + wy, TZ + dz * hw);
        out.dark.push(tintGeometry(boxUV(geo)));
      }
    }
  }
  if (yTop > y0 + 2.0) {
    out.dark.push(box(0.8, 1.7, 0.04, TX, y0, TZ - S.foot - 0.01));
    out.stone.push(slab(1.1, 0.18, 0.16, { bevel: 0.01, seed: seed + 3, wobble: 0, tone: 0, grime: 0 }).translate(TX, y0 + 1.72, TZ - S.foot - 0.06));
  }
  if (g >= 1) out.stone.push(slab(2 * S.head + 0.36, 0.2, 2 * S.head + 0.36, { bevel: 0.03, seed: seed + 4, wobble: 0, tone: 0.02, grime: 0 }).translate(TX, S.top, TZ));
  // The ramp winding round it twice, from the door's corner up to the top (A Coruna's), with its parapet.
  const ra = hgrow(t, 'ramp');
  if (ra > 0) {
    const faces = 8;
    const shown = Math.round(faces * ra);
    const rise = (S.top - 0.35 - (y0 + 0.3)) / faces;
    for (let k = 0; k < shown; k++) {
      const ya = y0 + 0.3 + k * rise;
      const yb = ya + rise;
      // Round the faces in turn: the -z face (toward -x), the -x face (toward +z), +z (toward +x), +x (toward -z).
      const side = k % 4;
      const hm = half((ya + yb) / 2) + 0.3;
      const L = 2 * hm;
      const ledge = rake(-L / 2, ya - 0.16, L / 2, yb - 0.16, 0, 0.6, 0.16, 0.9);
      const wall = rake(-L / 2, ya, L / 2, yb, 0.27, 0.07, 0.55, 0.95);
      // (Built along +x rising, its outside toward +z: turned so +z is the face's outward side.)
      for (const geo of [ledge, wall]) {
        geo.rotateY([Math.PI, -Math.PI / 2, 0, Math.PI / 2][side]);
        const [dx, dz] = [[0, -1], [-1, 0], [0, 1], [1, 0]][side];
        geo.translate(TX + dx * hm, 0, TZ + dz * hm);
      }
      out.stone.push(ledge);
      out.ashlar.push(wall);
    }
  }
}

/** The eight-sided storey (Dover's), coursed likewise, its windows, its cornice. */
function octStorey(out, t, lod, seed) {
  const g = hgrow(t, 'oct');
  if (g <= 0) return;
  const O = H.oct;
  const y0 = H.square.top + 0.2;
  const yTop = y0 + (O.top - y0) * g;
  // A prism of eight sides: the cylinder's eight-sided cousin, its corners on the radius / cos(22.5).
  const R8 = O.r / Math.cos(Math.PI / 8);
  courses(out, y0, yTop, 1.0, (ya, yb, k, kind) => {
    const geo = new CylinderGeometry(R8 * (1 - 0.02 * (ya - y0)), R8 * (1 - 0.02 * (ya - y0)), yb - ya, 8, 1);
    geo.rotateY(Math.PI / 8);
    geo.translate(TX, ya + (yb - ya) / 2, TZ);
    (kind === 'brick' ? out.brick : out.ashlar).push(tintGeometry(boxUV(geo), () => (kind === 'brick' ? 0.88 : 0.92 + (k % 2) * 0.04)));
  });
  if (lod < 2 && yTop > y0 + 2.0) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const geo = new BoxGeometry(0.16, 0.6, 0.02);
      geo.rotateY(a);
      geo.translate(TX + Math.sin(a) * (O.r + 0.004), y0 + 1.9, TZ + Math.cos(a) * (O.r + 0.004));
      out.dark.push(tintGeometry(boxUV(geo)));
    }
  }
  if (g >= 1) {
    const c = new CylinderGeometry(R8 + 0.2, R8 + 0.12, 0.2, 8, 1);
    c.rotateY(Math.PI / 8);
    out.stone.push(tintGeometry(boxUV(c.translate(TX, O.top + 0.1, TZ)), () => 0.96));
  }
}

/** The lantern: the round floor, eight columns, the entablature, the bronze cupola and the god's statue; the hearth, its reflector. */
function lantern(out, t, lod, seed) {
  const g = hgrow(t, 'lantern');
  if (g <= 0) return;
  const L = H.lantern;
  const seg = lod === 2 ? 12 : lod ? 20 : 36;
  const y0 = L.floor;
  out.stone.push(revolve(profileOf([[0, y0 - 0.2], [L.r + 0.25, y0 - 0.2], [L.r + 0.25, y0], [0, y0]]), { segments: seg, metres: 1 }).translate(TX, 0, TZ));
  // The columns, as many as stand.
  const n = Math.round(8 * Math.min(1, g * 1.3));
  for (let k = 0; k < n; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const x = TX + Math.sin(a) * L.r;
    const z = TZ + Math.cos(a) * L.r;
    out.marble.push(tintGeometry(boxUV(new CylinderGeometry(0.1, 0.12, L.colH - 0.2, lod ? 6 : 10, 1).translate(x, y0 + 0.1 + (L.colH - 0.2) / 2, z)), () => 0.95));
    out.marble.push(box(0.3, 0.1, 0.3, x, y0, z, 0.9));
    out.marble.push(box(0.32, 0.12, 0.32, x, y0 + L.colH - 0.12, z, 0.98));
  }
  // The hearth in the middle, its iron grate.
  out.stone.push(revolve(profileOf([[0, y0], [0.55, y0], [0.55, y0 + 0.22], [0.45, y0 + 0.26], [0, y0 + 0.26]]), { segments: lod ? 10 : 18, metres: 0.5 }).translate(TX, 0, TZ));
  if (g < 0.6) return;
  // The reflector: a great bronze dish standing behind the fire, turned out to sea (+z), tilted down a little.
  if (lod < 2) {
    const dish = new SphereGeometry(1.0, lod ? 12 : 20, lod ? 6 : 10, 0, Math.PI * 2, 0, 0.62);
    dish.rotateX(Math.PI / 2 + 0.12);
    dish.translate(TX, y0 + 1.15, TZ - 0.15);
    out.reflector.push(tintGeometry(boxUV(dish), () => 1));
    out.iron.push(tube([[TX, y0 + 0.26, TZ - 0.45], [TX, y0 + 0.9, TZ - 0.95]], 0.04, { radial: 5, segments: 3, around: 0.2 }));
  }
  const cu = hgrow(t, 'cupola');
  if (cu <= 0) return;
  // The entablature ring, the cupola of bronze over it, the god on top with his trident.
  const ey = y0 + L.colH;
  out.stone.push(revolve(profileOf([[L.r - 0.18, ey], [L.r + 0.22, ey], [L.r + 0.22, ey + 0.32], [L.r + 0.3, ey + 0.4], [L.r - 0.18, ey + 0.4], [L.r - 0.18, ey]]), { segments: seg, metres: 1 }).translate(TX, 0, TZ));
  if (cu < 1) return;
  const cupola = revolve(profileOf([[L.r + 0.25, ey + 0.4], { arc: [0, ey + 0.4, L.r + 0.25, 0, Math.PI / 2], n: lod ? 5 : 9 }, [0, ey + 0.4 + (L.r + 0.25) * 0.85]]), { segments: seg, metres: 0.6, deform: (p) => { p.y = ey + 0.4 + (p.y - ey - 0.4) * 0.72; } });
  out.bronze.push(cupola.translate(TX, 0, TZ));
  const sy = ey + 0.4 + (L.r + 0.25) * 0.72;
  if (lod < 2) {
    const body = revolve(profileOf([[0.2, 0], [0.22, 0.1], [0.19, 0.7], [0.17, 1.05], [0.21, 1.28], [0.22, 1.42], [0.16, 1.52], [0.05, 1.57], [0, 1.57]]), { segments: lod ? 8 : 12, metres: 0.5 });
    out.statue.push(body.scale(0.95, 0.95, 0.75).translate(TX, sy + 0.1, TZ));
    out.statue.push(tintGeometry(boxUV(new SphereGeometry(0.11, lod ? 7 : 10, 6).scale(0.92, 1.12, 1).translate(TX, sy + 0.1 + 1.66, TZ))));
    for (const [k, list] of Object.entries(trident(lod, 'gilt', 2.0))) for (const geo of list) (k === 'gilt' ? out.gilt : out.statue).push(geo.translate(TX + 0.28, sy + 0.2, TZ + 0.05));
  }
  out.stone.push(slab(0.5, 0.12, 0.5, { bevel: 0.02, seed: seed + 9, wobble: 0, tone: 0, grime: 0 }).translate(TX, sy, TZ));
}

/** The blaze on the hearth (lit) or its cold ash (dark), once the first fire is lit. */
function blaze(p, m, lod, seed) {
  const [fx, fy, fz] = H.fire;
  const y0 = H.lantern.floor + 0.26;
  // Logs crossed on the hearth, burning: the timber's own shapes in the embers' glow.
  const logs = [];
  for (let k = 0; k < (lod ? 4 : 8); k++) {
    const a = (k / (lod ? 4 : 8)) * Math.PI;
    const geo = new CylinderGeometry(0.07, 0.07, 0.9, lod ? 5 : 7, 1);
    geo.rotateZ(Math.PI / 2 - 0.25);
    geo.rotateY(a);
    geo.translate(fx, y0 + 0.12 + (k % 2) * 0.1, fz);
    logs.push(tintGeometry(boxUV(geo)));
  }
  p.add('logs', m.charred, logs, { cast: false });
  const big = hearthFire([fx, y0 + 0.1, fz], 0.5, { lod, seed, big: 3.6 });
  p.add('embers', m.ember, big.hot, { when: 'open', cast: false });
  p.add('coals', m.ash, big.dark, { cast: false });
  p.add('flames', m.flame, big.flames, { when: 'open', cast: false });
  p.add('ash', m.ash, big.ash, { when: 'shut', cast: false });
  void fy;
}

/** The timber in the store: logs stacked under the lean-to by how full it is (`n` 0..3). */
export function buildPharusWood(n, { lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const m = harbourMaterials();
  const p = new TaggedParts(`pharus-wood-${n}`);
  const [sx0, sx1, sz0, sz1] = H.store;
  const list = [];
  for (let k = 0; k < n; k++) {
    for (const g of woodpile(sx1 - sx0 - 0.5, 0.75, 31 + k, lod)) list.push(g.translate((sx0 + sx1) / 2, H.top + k * 0.0, sz0 + 0.55 + k * 0.6));
  }
  if (list.length) p.add('logs', m.wood, list, { cast: lod < 2 });
  return p.build();
}

/** The lighthouse's materials: the harbour's, the limestone faces, the fire's. */
function pharusMaterials() {
  const m = harbourMaterials();
  return {
    ...m,
    ashlar: material('pharus-ashlar', { surface: 'ashlarLime', vertexColors: true, snow: 1 }),
    flags: material('fort-flags', { surface: 'limestone', color: 0xb8ab94, vertexColors: true, snow: 0.8 }),
    marble: material('marble', { surface: 'marble', vertexColors: true, snow: 1 }),
    statue: material('gov-statue-bronze', { surface: 'bronze', color: 0x9aa58c, rough: 1.3, vertexColors: true, snow: 0.7 }),
    reflector: material('pharus-mirror', { surface: 'bronze', color: 0xffd890, rough: 0.35, vertexColors: true, snow: 0.3 }),
    // (The altars' deeper flame: the beacons' read as a pale cone this size.)
    flame: material('altar-flame', { color: 0xff9a40, roughness: 1, emissive: 0xff5e14, emissiveIntensity: 2.4, snow: 0, wet: 0 }),
    ash: material('cold-ash', { color: 0x4a4440, roughness: 0.95, snow: 1 }),
    charred: material('charred-wood', { color: 0x2a211b, roughness: 0.95, snow: 0.6 }),
    mud: material('drained-mud', { surface: 'earth', color: 0x6a5a48, vertexColors: true, snow: 0.6, wet: 1 }),
    gilt: material('gov-gilt', { color: 0xe8b450, roughness: 0.3, metalness: 0.85, vertexColors: true, snow: 0.5 }),
  };
}

/** Build the lighthouse at timeline `t` (4 finished): { group, meshes, triangles }; `ice` keeps the foam off the frozen margins. */
export function buildPharus(t, { lod = 0, seed = 1401, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['stone', 'ashlar', 'tufa', 'brick', 'flags', 'tile', 'wood', 'dark', 'iron', 'bronze', 'marble', 'statue', 'gilt', 'reflector', 'foam', 'mud'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  quay(out, t, lod, seed);
  lodge(out, t, lod, seed + 100);
  platform(out, t, lod, seed + 200, ice);
  squareStorey(out, t, lod, seed + 300);
  octStorey(out, t, lod, seed + 400);
  lantern(out, t, lod, seed + 500);
  const m = pharusMaterials();
  const p = new TaggedParts('pharus');
  const small = { cast: false };
  p.add('stone', m.trav, out.stone);
  p.add('ashlar', m.ashlar, out.ashlar);
  p.add('piers', m.tufa, out.tufa);
  p.add('brick', m.brick, out.brick);
  p.add('flags', m.flags, out.flags, small);
  p.add('roof', m.tile, out.tile);
  p.add('timber', m.wood, out.wood);
  if (out.dark.length) p.add('inside', m.dark, out.dark, small);
  if (out.iron.length) p.add('iron', m.iron, out.iron, small);
  if (out.bronze.length) p.add('bronze', m.bronze, out.bronze);
  if (out.marble.length) p.add('marble', m.marble, out.marble);
  if (out.statue.length) p.add('statue', m.statue, out.statue, { cast: lod === 0 });
  if (out.gilt.length) p.add('gilt', m.gilt, out.gilt, small);
  if (out.reflector.length) p.add('reflector', m.reflector, out.reflector, small);
  if (out.mud.length) p.add('mud', m.mud, out.mud, small);
  if (!ice && out.foam.length) p.add('foam', m.foam, out.foam, small);
  if (hgrow(t, 'fire') > 0) blaze(p, m, lod, seed + 600);
  // The lodge's door: open while the light is kept, shut when dark.
  if (hgrow(t, 'quay') >= 1) {
    const [, , , z1] = H.lodge;
    const door = box(0.08, 1.65, 0.86, -4.42, H.top, z1 - 0.72, 0.7);
    p.add('door', m.wood, [door], { when: 'open' });
    p.add('door', m.wood, [box(0.86, 1.65, 0.08, -4.0, H.top, z1 - 0.3, 0.7)], { when: 'shut' });
  }
  void iceMaterial;
  return p.build();
}

// ---------------------------------------------------------------------------
// The people and the site
// ---------------------------------------------------------------------------

/** The keepers while the light is kept: one carrying wood from the store to the tower's door, one feeding the fire at the top. */
export function pharusActors() {
  const y = H.top + 0.02;
  const [sx0, sx1, , sz1] = H.store;
  const from = [(sx0 + sx1) / 2 - 0.4, y, sz1 + 0.5];
  const to = [TX + 0.55, y, TZ - H.square.foot - 0.6];
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  return [
    { body: 'm', dress: ['tunic:short'], hair: 'crop', beard: 'short', clip: 'carry', props: { L: 'logs' }, at: from, ry: Math.atan2(dx, dz), seed: 801, colours: { tunic: DYES.brownWool },
      route: { length: Math.hypot(dx, dz), speed: 0.6, pauseEnd: 4, pauseStart: 5, clipEnd: 'give', clipStart: 'shoulder', faceStart: Math.PI / 2 } },
    { body: 'm', dress: ['tunic:short'], hair: 'curls', clip: 'give', at: [TX + 0.0, H.lantern.floor + 0.02, TZ - 0.95], ry: 0, seed: 802, colours: { tunic: DYES.fawn } },
    { body: 'm', dress: ['tunic:knee'], hair: 'bald', old: true, clip: 'idle', at: [-3.2, y, -2.85], ry: 0.4, seed: 803, colours: { tunic: DYES.oatmeal } },
  ];
}

function builder(seed, extra) {
  const tones = [DYES.undyed, DYES.oatmeal, DYES.fawn, DYES.brownWool, DYES.ochre];
  return { body: 'm', dress: ['tunic:short'], hair: seed % 3 ? 'crop' : 'curls', seed, colours: { tunic: tones[seed % tones.length] }, ...extra };
}

/** The crew by stage: at the piers, at the tower's foot, on its storeys; carriers on the quay, the crane's windlass. */
export function pharusCrew(stage) {
  const y = H.top + 0.02;
  const list = [
    builder(901, { clip: 'carry', props: { L: 'sack' }, at: [-4.6, y, -4.6], ry: Math.PI / 2, route: { length: 6.4, speed: 0.7, pauseEnd: 3, pauseStart: 4, clipEnd: 'shoulder', clipStart: 'shoulder', faceEnd: Math.PI, faceStart: 0 } }),
  ];
  if (stage === 0) {
    list.push(builder(903, { clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [-2.4, y, -1.5], ry: Math.PI }));
    list.push(builder(904, { clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [2.6, y, -1.6], ry: Math.PI }));
  } else {
    const yy = stage === 1 ? y : stage === 2 ? H.square.top + 0.22 : H.oct.top + 0.22;
    const off = stage === 1 ? H.square.foot + 0.7 : stage === 2 ? H.square.head - 0.25 : H.oct.r - 0.25;
    list.push(builder(905, { clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [TX - 0.6, yy, TZ - off], ry: 0 }));
    list.push(builder(906, { clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [TX + off, yy, TZ + 0.4], ry: -Math.PI / 2 }));
  }
  return list;
}

/** The site's dressing at timeline `t`, with the goods in `piles` ({ good: 0..3 }). */
export function pharusSite(t, piles = {}) {
  const site = { scaffolds: [], cranes: [], centering: [], piles: [], crew: [] };
  const stage = Math.floor(t);
  const S = H.square;
  if (stage === 0) {
    site.cranes.push({ x: 3.5, z: -2.6, ry: Math.PI, h: 4.5, kind: 'shear', y: H.top });
  } else if (stage === 1) {
    const h = (S.top - H.top) * hgrow(t, 'square') + 1.4;
    for (const [dx, dz, ry] of [[0, -1, 0], [1, 0, Math.PI / 2], [0, 1, 0], [-1, 0, Math.PI / 2]]) site.scaffolds.push({ x: TX + dx * (S.foot + 0.5), z: TZ + dz * (S.foot + 0.5), w: 2 * S.foot + 1.4, d: 0.75, h, ry, y: H.top });
    site.cranes.push({ x: 3.5, z: -1.7, ry: 0, h: 9.5, kind: 'treadwheel', y: H.top });
  } else if (stage === 2) {
    const h = (H.oct.top - S.top) * hgrow(t, 'oct') + 1.4;
    for (const [dx, dz, ry] of [[0, -1, 0], [1, 0, Math.PI / 2], [0, 1, 0], [-1, 0, Math.PI / 2]]) site.scaffolds.push({ x: TX + dx * (H.oct.r + 0.45), z: TZ + dz * (H.oct.r + 0.45), w: 2 * H.oct.r + 0.6, d: 0.6, h, ry, y: S.top + 0.2 });
    // (Shear legs up on the square storey's top for the lighter courses above.)
    site.cranes.push({ x: 0.0, z: TZ - 1.9, ry: Math.PI, h: 4.5, kind: 'shear', y: S.top + 0.2 });
  } else {
    site.scaffolds.push({ x: TX, z: TZ - H.lantern.r - 0.4, w: 2 * H.lantern.r + 0.6, d: 0.55, h: 3.6, ry: 0, y: H.oct.top + 0.2 });
    site.cranes.push({ x: 0.0, z: TZ - 1.5, ry: Math.PI, h: 4.0, kind: 'shear', y: H.oct.top + 0.2 });
  }
  const spots = { clay: [-1.5, -5.2, 0.04], timber: [1.9, -5.2, -0.04], marble: [-1.5, -3.2, 0.03], iron: [1.9, -3.2, 0] };
  for (const [good, n] of Object.entries(piles)) {
    const s = spots[good];
    if (s && n > 0) site.piles.push({ x: s[0], z: s[1], ry: s[2], good, n: Math.min(3, n), y: H.top });
  }
  site.crew = pharusCrew(stage);
  return site;
}
