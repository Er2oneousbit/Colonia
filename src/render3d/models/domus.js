/**
 * models/domus.js
 * ----------------------------------------------------------------------------
 * What the senate house and the governor's three residences of the 3D look
 * share (curia.js, praetorium.js, praetoriumMaius.js, regia.js): their
 * materials, the columns of their porticoes (built once as kits of their
 * own and instanced, models/government.js), walls with openings, the
 * Roman house's roofs that fall inward round its courts, painted walls,
 * doors and shutters, inscriptions in Roman capitals, the people (men in
 * the toga, the household, lictors and guards), statues, water (an
 * impluvium, a basin with its jet) and a garden's beds.
 *
 * The house's roofs: a Roman town house turned its back on the street.
 * Its rooms stood round open courts (the atrium, the peristyle), and their
 * roofs fell inward to the court (the compluviate roof Vitruvius
 * describes, VI.3), so the rain ran off into the impluvium and the garden.
 * ringRoof() is that roof: four tiled slopes from the outer walls' tops
 * down to the court's edge, meeting in valleys at the corners. A house of
 * two courts is two rings that meet in a ridge over the wall between them.
 *
 * Metres, y up, facing +z, as the other models (models/well.js); every
 * geometry has position, normal, uv (metres) and an RGB colour, so merge()
 * takes them.
 * ----------------------------------------------------------------------------
 */

import {
  BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry, BufferGeometry, Float32BufferAttribute,
  Matrix4, Vector3, Quaternion,
} from 'three';
import { revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import {
  material, waterMaterial, shallowWaterMaterial, streamMaterial, ringMaterial,
} from '../materials.js';
import { artRng, smoothstep } from '../texgen.js';
import { slab, GLYPHS, lantern, lanternPane } from './masonry.js';
import { lin, D } from './rural.js';
import { box, staff, people } from './castra.js';
import { learningMaterials, person, at, roofSlope, bush, hedge } from './learning.js';

export { box, D, lin, lantern, lanternPane };

// ---------------------------------------------------------------------------
// Materials and colours
// ---------------------------------------------------------------------------

/** The materials the four share besides the schools' and the forts' (learning.js, castra.js). */
export function govMaterials() {
  const m = learningMaterials();
  return {
    ...m,
    // White stucco over the walls (Vitruvius's marble stucco, polished to imitate marble).
    stucco: material('gov-stucco', { surface: 'stucco', color: 0xffffff, vertexColors: true, snow: 1 }),
    // Walls painted in fresco under the porticoes and in the rooms: one material, the colours in
    // the vertices, and no snow (a roof is over them; the look lays snow by facing).
    fresco: material('gov-fresco', { surface: 'stucco', vertexColors: true, snow: 0 }),
    brick: material('brick', { surface: 'brick', vertexColors: true, snow: 1 }),
    // Mosaic floors and thresholds: tesserae of stone, their pattern in the vertices.
    tesserae: material('gov-tesserae', { surface: 'cocciopesto', color: 0xf2ece0, vertexColors: true, snow: 0 }),
    lawn: material('gov-lawn', { surface: 'earth', color: 0x9fb46c, vertexColors: true, snow: 1 }),
    flowers: material('gov-flowers', { color: 0xffffff, roughness: 0.7, vertexColors: true, snow: 0.6 }),
    water: waterMaterial(),
    shallow: shallowWaterMaterial(),
    stream: streamMaterial(),
    sheet: streamMaterial(true),
    ring: ringMaterial(),
    // The stucco's scored joints, a shade darker than its face.
    joint: material('gov-stucco-joint', { surface: 'stucco', color: 0xc9bfad, vertexColors: true, snow: 0.5 }),
    // A lantern's pane unlit (the lit one is masonry.js lanternPane).
    // Statues in bronze gone dark and green with age (the honorary statues on their pedestals).
    statueBronze: material('gov-statue-bronze', { surface: 'bronze', color: 0x9aa58c, rough: 1.3, vertexColors: true, snow: 0.7 }),
    lampOut: material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }),
  };
}

/** Fresco colours (linear RGB), after the Pompeian styles: cinnabar red, black, yellow ochre, white, green. */
export const FRESCO = Object.freeze({
  red: lin(0x9e2a1c, 1.6),
  black: lin(0x221a16, 1.2),
  ochre: lin(0xd09a3a, 1.4),
  white: lin(0xece4d0),
  green: lin(0x4f7652, 1.3),
  blue: lin(0x3f6584, 1.3),
});

/** The governor's colour: the purple-red of a magistrate's border and his banners. */
export const PURPLE = lin(0x6e1a3c, 1.3);
const GOLD = lin(0xd8a84a);

// ---------------------------------------------------------------------------
// Walls, openings, painted faces
// ---------------------------------------------------------------------------

/**
 * A wall along x (axis 'x': from a to b, its middle line at z = at) or
 * along z, `t` thick, y0..y1, with openings [{ a, b, lo, hi }] (doors from
 * the floor, windows between): plain boxes round them, UVs in metres so a
 * stucco or a brick runs on across the pieces. Returns geometries.
 */
export function wallAlong(axis, a, b, at, t, y0, y1, openings = [], k = 1) {
  const out = [];
  const put = (p0, p1, q0, q1) => {
    if (p1 - p0 < 1e-3 || q1 - q0 < 1e-3) return;
    out.push(axis === 'x' ? box(p1 - p0, q1 - q0, t, (p0 + p1) / 2, q0, at, k) : box(t, q1 - q0, p1 - p0, at, q0, (p0 + p1) / 2, k));
  };
  const ops = [...openings].sort((p, q) => p.a - q.a);
  let x = a;
  for (const o of ops) {
    put(x, o.a, y0, y1);
    put(o.a, o.b, y0, o.lo);
    put(o.a, o.b, o.hi, y1);
    x = o.b;
  }
  put(x, b, y0, y1);
  return out;
}

/**
 * A wall's face painted in fresco, from a to b along its axis at `at` (the
 * face's plane, `n` its outward side: +1 or -1 along the other axis),
 * y0..y1, skipping `gaps` [[a, b]] (doors): a dark dado, the main zone in
 * `main` with panels framed in `frame` (lod 0), a white frieze under the
 * roof. Thin boxes standing 6 mm proud of the wall. Returns geometries.
 */
export function frescoFace(axis, a, b, at, n, y0, y1, { main = FRESCO.red, frame = FRESCO.ochre, dado = FRESCO.black, gaps = [], lod = 0, panel = 1.3 } = {}) {
  const out = [];
  const t = 0.012;
  const c = at + n * t / 2;
  const put = (p0, p1, q0, q1, col) => {
    if (p1 - p0 < 0.02 || q1 - q0 < 0.01) return;
    out.push(axis === 'x' ? box(p1 - p0, q1 - q0, t, (p0 + p1) / 2, q0, c, () => col) : box(t, q1 - q0, p1 - p0, c, q0, (p0 + p1) / 2, () => col));
  };
  const spans = [];
  let x = a;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    spans.push([x, g0]);
    x = g1;
  }
  spans.push([x, b]);
  const dadoTop = y0 + Math.min(0.8, (y1 - y0) * 0.25);
  const friezeBot = y1 - Math.min(0.42, (y1 - y0) * 0.14);
  for (const [p0, p1] of spans) {
    put(p0, p1, y0, dadoTop, dado);
    put(p0, p1, dadoTop, friezeBot, main);
    put(p0, p1, friezeBot, y1, FRESCO.white);
    if (lod > 0 || p1 - p0 < panel * 0.8) continue;
    // The panels' frames: thin bands of ochre round each panel of the main zone, and a line over the dado.
    const nP = Math.max(1, Math.round((p1 - p0) / panel));
    const w = (p1 - p0) / nP;
    const lift = n * 0.004;
    const fr = (q0, q1, r0, r1) => {
      const g = axis === 'x' ? box(q1 - q0, r1 - r0, t, (q0 + q1) / 2, r0, c + lift, () => frame) : box(t, r1 - r0, q1 - q0, c + lift, r0, (q0 + q1) / 2, () => frame);
      out.push(g);
    };
    fr(p0, p1, dadoTop, dadoTop + 0.035);
    for (let k = 0; k < nP; k++) {
      const q0 = p0 + k * w + 0.16;
      const q1 = p0 + (k + 1) * w - 0.16;
      const r0 = dadoTop + 0.2;
      const r1 = friezeBot - 0.2;
      if (q1 - q0 < 0.2 || r1 - r0 < 0.3) continue;
      fr(q0, q1, r0, r0 + 0.03);
      fr(q0, q1, r1 - 0.03, r1);
      fr(q0, q0 + 0.03, r0, r1);
      fr(q1 - 0.03, q1, r0, r1);
    }
  }
  return out;
}

/**
 * The dark of a room seen through an opening in a wall along `axis`: a box
 * just inside the wall's inner face (at `at`, `n` the room's side), as wide
 * and tall as the opening. Returns a geometry for the room-dark material.
 */
export function darkIn(axis, a, b, lo, hi, at, n, depth = 0.05) {
  const c = at + n * depth / 2;
  return axis === 'x' ? box(b - a + 0.04, hi - lo, depth, (a + b) / 2, lo, c) : box(depth, hi - lo, b - a + 0.04, c, lo, (a + b) / 2);
}

/**
 * Double doors in an opening along x (centred on x, `w` wide, `h` tall,
 * their foot at y0, in the wall's plane at z, the inside toward -z):
 * panelled leaves with bronze studs (lod 0). `open`: each leaf swung back
 * into the room against the reveal. Returns { wood, bronze }, or { bronze }
 * alone with `metal` (the curia's doors are bronze through).
 */
export function doubleDoor(x, z, w, h, y0, { open = false, lod = 0, metal = false, studs = true } = {}) {
  const wood = [];
  const bronze = [];
  const leafW = w / 2 - 0.01;
  const th = 0.07;
  for (const s of [-1, 1]) {
    const hinge = new Vector3(x + s * w / 2, y0, z);
    const parts = [];
    // The leaf, then its panels (two tall, one short) raised a little, and a row of studs on its stiles.
    parts.push([box(leafW, h - 0.02, th, -s * leafW / 2, 0.01, 0, 0.9), metal ? 'bronze' : 'wood']);
    if (lod < 2) {
      const pw = leafW - 0.2;
      const ph = (h - 0.5) / 3;
      for (const [y, hh] of [[0.18, ph * 0.8], [0.32 + ph * 0.8, ph * 1.1], [0.46 + ph * 1.9, ph * 1.1]]) {
        parts.push([box(pw, hh, 0.02, -s * leafW / 2, y, th / 2 + 0.008, 0.82), metal ? 'bronze' : 'wood']);
      }
      if (lod === 0 && studs) {
        for (let k = 0; k < 6; k++) {
          for (const sx of [0.06, leafW - 0.06]) {
            const st = new SphereGeometry(0.022, 6, 4);
            st.translate(-s * sx, 0.25 + k * ((h - 0.5) / 5), th / 2 + 0.012);
            parts.push([tintGeometry(boxUV(st), () => 1), 'bronze']);
          }
        }
        // A ring handle on each leaf.
        const ring = new TorusGeometry(0.07, 0.012, 5, 12);
        ring.translate(-s * (leafW - 0.18), h * 0.48, th / 2 + 0.025);
        parts.push([tintGeometry(boxUV(ring), () => 1), 'bronze']);
      }
    }
    const turn = open ? -s * D(84) : 0;
    const m = new Matrix4().makeRotationY(turn).setPosition(hinge.x, hinge.y, hinge.z - th / 2);
    for (const [g, key] of parts) {
      g.applyMatrix4(m);
      (key === 'bronze' ? bronze : wood).push(g);
    }
  }
  return metal ? { bronze: [...wood, ...bronze] } : { wood, bronze };
}

/** A window's two board shutters in an opening along x at z (centred x, w x h, foot y0): shut across it, or folded back against the wall outside. */
export function shutters(x, z, w, h, y0, open, n = 1) {
  const out = [];
  const leafW = w / 2;
  for (const s of [-1, 1]) {
    const g = box(leafW - 0.01, h - 0.02, 0.035, -s * leafW / 2, 0.01, 0, 0.75);
    // (Folded back flat against the wall: turned about the hinge at the opening's edge.)
    const turn = open ? s * n * D(170) : 0;
    g.applyMatrix4(new Matrix4().makeRotationY(turn).setPosition(x + s * w / 2, y0, z + n * 0.02));
    out.push(g);
  }
  return out;
}

/**
 * A tiled ring of roof round an open court, after the compluviate roof:
 * four slopes from the outer walls' tops (`outer` [x0, x1, z0, z1] at
 * topY) down to the court's edge (`inner`, the same, at eaveY), meeting
 * in valleys from the outer corners to the inner ones, the boards under
 * them. `skip`: sides left out ('f', 'b', 'l', 'r': +z, -z, -x, +x).
 * Returns { tile, wood }.
 */
export function ringRoof(outer, inner, topY, eaveY, { lod = 0, seed = 1, skip = '' } = {}) {
  const [x0, x1, z0, z1] = outer;
  const [a0, a1, b0, b1] = inner;
  const E = (x, z) => [x, eaveY, z];
  const T = (x, z) => [x, topY, z];
  const sides = {
    f: [E(a0, b1), E(a1, b1), T(x1, z1), T(x0, z1)],
    b: [E(a1, b0), E(a0, b0), T(x0, z0), T(x1, z0)],
    r: [E(a1, b1), E(a1, b0), T(x1, z0), T(x1, z1)],
    l: [E(a0, b0), E(a0, b1), T(x0, z1), T(x0, z0)],
  };
  const tile = [];
  const wood = [];
  let k = 0;
  for (const [side, q] of Object.entries(sides)) {
    k++;
    if (skip.includes(side)) continue;
    const r = roofSlope(q, { lod, seed: seed + k * 7 });
    tile.push(...r.tile);
    wood.push(...r.wood);
  }
  return { tile, wood };
}

/**
 * A tiled gable roof over x0..x1, z0..z1 (the walls' outer faces), its
 * ridge along `along` ('x' or 'z'), eaves at eaveY running `over` past the
 * walls, `gableOver` past the gable walls, at `pitch` (radians): the
 * masonry's sheet and imbrices (lighter than the farms' tile by tile,
 * which a hall of this size would make 20,000 triangles), boards under,
 * a ridge of rounded tiles. Returns { tile, wood, ridgeY }.
 */
export function gable({ x0, x1, z0, z1, eaveY, pitch = D(22), along = 'z', over = 0.3, gableOver = 0.25, lod = 0, seed = 1 }) {
  const alongZ = along === 'z';
  const half = alongZ ? (x1 - x0) / 2 : (z1 - z0) / 2;
  const ridgeY = eaveY + half * Math.tan(pitch);
  const eY = eaveY - over * Math.tan(pitch);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const tile = [];
  const wood = [];
  const quads = alongZ
    ? [
      [[x1 + over, eY, z1 + gableOver], [x1 + over, eY, z0 - gableOver], [cx, ridgeY, z0 - gableOver], [cx, ridgeY, z1 + gableOver]],
      [[x0 - over, eY, z0 - gableOver], [x0 - over, eY, z1 + gableOver], [cx, ridgeY, z1 + gableOver], [cx, ridgeY, z0 - gableOver]],
    ]
    : [
      [[x0 - gableOver, eY, z1 + over], [x1 + gableOver, eY, z1 + over], [x1 + gableOver, ridgeY, cz], [x0 - gableOver, ridgeY, cz]],
      [[x1 + gableOver, eY, z0 - over], [x0 - gableOver, eY, z0 - over], [x0 - gableOver, ridgeY, cz], [x1 + gableOver, ridgeY, cz]],
    ];
  quads.forEach((q, k) => {
    const r = roofSlope(q, { lod, seed: seed + k * 5 });
    tile.push(...r.tile);
    wood.push(...r.wood);
  });
  tile.push(alongZ ? ridgeCap(cx, z0 - gableOver - 0.02, cx, z1 + gableOver + 0.02, ridgeY + 0.02, lod) : ridgeCap(x0 - gableOver - 0.02, cz, x1 + gableOver + 0.02, cz, ridgeY + 0.02, lod));
  return { tile, wood, ridgeY };
}

/**
 * A rectangle x0..x1, z0..z1 less the rectangles `holes` (each wholly
 * inside it, not overlapping each other in z): the pieces round them, as
 * [x0, x1, z0, z1] rectangles (a floor round an impluvium, a garden).
 */
export function rectMinus(r, holes) {
  let pieces = [r];
  for (const [hx0, hx1, hz0, hz1] of holes) {
    const next = [];
    for (const [x0, x1, z0, z1] of pieces) {
      if (hx1 <= x0 || hx0 >= x1 || hz1 <= z0 || hz0 >= z1) {
        next.push([x0, x1, z0, z1]);
        continue;
      }
      const a0 = Math.max(x0, hx0);
      const a1 = Math.min(x1, hx1);
      const b0 = Math.max(z0, hz0);
      const b1 = Math.min(z1, hz1);
      if (b0 > z0) next.push([x0, x1, z0, b0]);
      if (b1 < z1) next.push([x0, x1, b1, z1]);
      if (a0 > x0) next.push([x0, a0, b0, b1]);
      if (a1 < x1) next.push([a1, x1, b0, b1]);
    }
    pieces = next;
  }
  return pieces.filter(([x0, x1, z0, z1]) => x1 - x0 > 1e-3 && z1 - z0 > 1e-3);
}

/** A slab over each rectangle, from y0 to y1 (a floor's pieces), vertex colour k. */
export function slabs(rects, y0, y1, k = 1) {
  return rects.map(([x0, x1, z0, z1]) => box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, k));
}

/**
 * A peristyle's or an atrium's court in the ring of its roof: the
 * architrave round the court's edge (`inner`) on its columns, the ring's
 * tiles from the outer walls' tops (`outer`) down to it, the stylobate
 * (the kerb the columns stand on) and the portico's floor between. Pushes
 * into out.tile, out.wood, out.beam, out.stylobate, out.floor; returns
 * the columns' places [x, z] (about `step` apart, on `sides`).
 */
export function court({ outer, inner, topY, eaveY, floorY, step, sides = 'fblr', lod = 0, seed = 1, out, beamH = 0.3, kerb = 0.1, holes = [] }) {
  const r = ringRoof(outer, inner, topY, eaveY, { lod, seed });
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  out.beam.push(...architraveRound(inner, eaveY - beamH, eaveY, 'fblr'));
  // The stylobate: a kerb of stone under the columns round the court, a step up from the garden.
  const [a0, a1, b0, b1] = inner;
  const w = 0.42;
  out.stylobate.push(...slabs(rectMinus([a0 - w / 2, a1 + w / 2, b0 - w / 2, b1 + w / 2], [[a0 + w / 2, a1 - w / 2, b0 + w / 2, b1 - w / 2]]), floorY - kerb, floorY + 0.005, 0.95));
  // The portico's floor between the stylobate and the walls.
  const [x0, x1, z0, z1] = outer;
  const t = 0.3;
  out.floor.push(...slabs(rectMinus([x0 + t, x1 - t, z0 + t, z1 - t], [[a0 - w / 2, a1 + w / 2, b0 - w / 2, b1 + w / 2], ...holes]), floorY - 0.12, floorY, 0.95));
  return columnsRound(inner, step, sides);
}

/** A ridge of rounded tiles from (x0, z0) to (x1, z1) at height y (where two rings or slopes meet). */
export function ridgeCap(x0, z0, x1, z1, y, lod = 0, r = 0.11) {
  const L = Math.hypot(x1 - x0, z1 - z0);
  const g = new CylinderGeometry(r, r, L, lod ? 4 : 8, 1, false, -Math.PI / 2, Math.PI);
  g.rotateZ(Math.PI / 2);
  g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return tintGeometry(boxUV(g), () => 0.9);
}

/** A moulded coping along a wall's top from a to b on `axis` at `at`, `t` thick: the cap that hides where a ring's slope meets the wall. */
export function coping(axis, a, b, at, t, y, k = 0.96) {
  const w = t + 0.12;
  return [
    axis === 'x' ? box(b - a + 0.12, 0.1, w, (a + b) / 2, y, at, k) : box(w, 0.1, b - a + 0.12, at, y, (a + b) / 2, k),
    axis === 'x' ? box(b - a + 0.06, 0.06, w - 0.06, (a + b) / 2, y + 0.1, at, k * 0.98) : box(w - 0.06, 0.06, b - a + 0.06, at, y + 0.1, (a + b) / 2, k * 0.98),
  ];
}

// ---------------------------------------------------------------------------
// Inscriptions
// ---------------------------------------------------------------------------

/** The letters the buildings' names need besides the forum's (masonry.js GLYPHS): N, D, Q. */
const MORE = Object.freeze({
  N: { w: 0.7, s: [[0, 0, 0, 1], [0, 1, 0.7, 0], [0.7, 0, 0.7, 1]] },
  D: { w: 0.66, s: [[0, 0, 0, 1], [0, 1, 0.34, 1], [0.34, 1, 0.58, 0.84], [0.58, 0.84, 0.66, 0.5], [0.66, 0.5, 0.58, 0.16], [0.58, 0.16, 0.34, 0], [0.34, 0, 0, 0]] },
  Q: { w: 0.8, s: [...GLYPHS.O.s, [0.46, 0.1, 0.8, -0.16]] },
  ' ': { w: 0.3, s: [] },
});
const ALL = { ...GLYPHS, ...MORE };

/** The width of `text` cut `h` tall (letters, gaps). */
export function textWidth(text, h) {
  return [...text].reduce((a, ch) => a + ALL[ch].w * h + h * 0.28, -h * 0.28);
}

/**
 * `text` in cut strokes centred on x = 0, its foot at y, its face at z, `h`
 * tall (masonry.js inscription, with N, D, Q and spaces): geometries for
 * the inscriptions' red, as Roman letters were cut and filled with red.
 */
export function letters(text, y, z, h) {
  const sw = h * 0.13;
  const gap = h * 0.28;
  let x = -textWidth(text, h) / 2;
  const out = [];
  for (const ch of text) {
    const g = ALL[ch];
    for (const [x0, y0, x1, y1] of g.s) {
      const ax = x + x0 * h;
      const ay = y + y0 * h;
      const bx = x + x1 * h;
      const by = y + y1 * h;
      const len = Math.hypot(bx - ax, by - ay) + sw * 0.8;
      const s = new BoxGeometry(len, sw, 0.006);
      s.rotateZ(Math.atan2(by - ay, bx - ax));
      s.translate((ax + bx) / 2, (ay + by) / 2, z);
      out.push(tintGeometry(boxUV(s)));
    }
    x += g.w * h + gap;
  }
  return out;
}

/**
 * A mosaic threshold lying on the floor at (x, y, z), `w` by `d`, its word
 * read from the street (+z): a white field, a black border and `text` in
 * black tesserae (the House of the Faun's HAVE, the SALVE of others).
 * Returns geometries for the tesserae material (colours in the vertices).
 */
export function threshold(text, x, y, z, w, d, lod = 0) {
  const black = FRESCO.black;
  const out = [box(w, 0.012, d, x, y, z, () => FRESCO.white)];
  if (lod === 2) return out;
  for (const s of [-1, 1]) {
    out.push(box(w, 0.016, 0.05, x, y, z + s * (d / 2 - 0.06), () => black));
    out.push(box(0.05, 0.016, d - 0.07, x + s * (w / 2 - 0.06), y, z, () => black));
  }
  if (lod === 0) {
    const h = Math.min(d * 0.5, (w * 0.7) / Math.max(1, textWidth(text, 1)));
    for (const g of letters(text, -h / 2, 0, h)) {
      // Laid flat, reading from the street.
      g.rotateX(-Math.PI / 2);
      g.translate(x, y + 0.016, z);
      out.push(tintGeometry(g, () => black));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

/**
 * Column orders, by their radius to their height (Vitruvius: a Doric
 * column seven of its diameters tall, an Ionic nine, a Corinthian ten).
 */
export const ORDERS = Object.freeze({
  // The peristyles of Pompeii: brick or tufa stuccoed, the lower third left smooth and painted red, fluted above, a Doric capital.
  pompeian: Object.freeze({ k: 1 / 14, flutes: 12, base: 'torus' }),
  ionic: Object.freeze({ k: 1 / 18, flutes: 20, base: 'attic' }),
  corinthian: Object.freeze({ k: 1 / 20, flutes: 24, base: 'attic' }),
  // The palace's hall: the Corinthian with its capital gilded.
  gilt: Object.freeze({ k: 1 / 20, flutes: 24, base: 'attic' }),
});

/**
 * A column standing on y 0, `h` to the top of its abacus, in `order`:
 * `smooth` leaves the shaft unfluted. Returns { stone, cap }: the shaft and
 * base in the column's stone (vertex colours: the pompeian's red third),
 * the capital apart (gilt on the palace's hall).
 */
export function column(order, h, lod = 0, { smooth = false } = {}) {
  const o = ORDERS[order];
  const r = h * o.k;
  const stone = [];
  const cap = [];
  const red = order === 'pompeian';
  const seg = lod === 2 ? 6 : lod ? 9 : 24;
  // The plinth and the base: a torus (Tuscan) or two tori with a scotia between (Attic).
  const ph = r * 0.32;
  stone.push(slab(r * 2.7, ph, r * 2.7, { bevel: r * 0.06, wobble: 0, tone: 0, grime: 0.25 }));
  const baseTop = ph + (o.base === 'attic' ? r * 0.62 : r * 0.42);
  if (lod === 1) {
    // (From the middle distance a base is a torus: one ring of faces.)
    stone.push(revolve(profileOf([[r * 1.2, ph], [r * 1.16, baseTop], [0, baseTop]]), { segments: seg, metres: 1, tint: () => 0.9 }));
  } else if (lod === 0) {
    const n = 3;
    const prof = o.base === 'attic'
      ? [[r * 1.3, ph], { arc: [r * 1.18, ph + r * 0.13, r * 0.13, D(-90), D(90)], n }, [r * 1.08, ph + r * 0.28], { arc: [r * 1.16, ph + r * 0.37, r * 0.09, D(-90), D(-180)], n }, [r * 1.06, ph + r * 0.43], { arc: [r * 1.1, ph + r * 0.52, r * 0.1, D(-90), D(90)], n }, [r, baseTop], [0, baseTop]]
      : [[r * 1.24, ph], { arc: [r * 1.12, ph + r * 0.2, r * 0.2, D(-90), D(90)], n }, [r, baseTop], [0, baseTop]];
    stone.push(revolve(profileOf(prof), { segments: seg, metres: 1, tint: () => 0.9 }));
  }
  // The capital's height, and the shaft up to it: a slight swell a third of the way up (entasis).
  const capH = order === 'pompeian' ? r * 0.9 : order === 'ionic' ? r * 0.8 : r * 2.3;
  const top = h - capH;
  const fluted = !smooth && lod === 0;
  const flutes = o.flutes;
  const third = baseTop + (top - baseTop) / 3;
  const rows = lod === 2 ? 1 : lod ? 3 : 4;
  const prof = [];
  const rAt = (t) => r * (1 - 0.14 * t + 0.03 * Math.sin(Math.PI * t * 0.9));
  for (let k = 0; k <= rows; k++) {
    const t = k / rows;
    const y = baseTop + (top - baseTop) * t;
    prof.push([rAt(t), y]);
    // (The red third's edge: a doubled ring, so the colour changes sharply there.)
    if (red && k < rows && third > y && third < baseTop + ((top - baseTop) * (k + 1)) / rows) {
      const tt = (third - baseTop) / (top - baseTop);
      prof.push([rAt(tt), third], [rAt(tt), third]);
    }
  }
  prof.push([0, top]);
  const redCol = [0.62, 0.17, 0.11];
  const thirdIdx = red ? prof.findIndex((p) => Math.abs(p[1] - third) < 1e-9) : -1;
  stone.push(revolve(prof, {
    segments: fluted ? flutes * 3 : seg,
    metres: 1.6,
    deform: fluted ? (p, th) => {
      const t = (p.y - baseTop) / (top - baseTop);
      // (Fluted above the red third only, on a pompeian column: the lower part was left smooth to take knocks.)
      if (t < (red ? 0.335 : 0.03) || t > 0.98) return;
      const c = Math.max(0, Math.cos(th * flutes));
      const kk = 1 - 0.07 * c;
      p.x *= kk;
      p.z *= kk;
    } : null,
    tint: (p, th, i) => (red && (i < thirdIdx + 1) ? redCol : 0.86 + 0.14 * smoothstep(baseTop, baseTop + 0.8, p.y)),
  }));
  // The capital.
  if (lod === 2) {
    cap.push(slab(r * 2.4, capH, r * 2.4, { bevel: 0, wobble: 0, tone: 0, grime: 0 }).translate(0, top, 0));
    return { stone, cap };
  }
  if (order === 'pompeian') {
    // A Doric echinus (a quarter round) under a square abacus.
    const n = lod ? 2 : 5;
    cap.push(revolve(profileOf([[r * 0.88, top], [r * 0.9, top + r * 0.1], { arc: [r * 0.9, top + r * 0.5, r * 0.4, D(-90), D(0)], n }, [r * 1.3, top + r * 0.5], [0, top + r * 0.5]]), { segments: seg, metres: 1 }));
    cap.push(slab(r * 2.6, capH - r * 0.5, r * 2.6, { bevel: r * 0.05, wobble: 0, tone: 0, grime: 0 }).translate(0, top + r * 0.5, 0));
  } else if (order === 'ionic') {
    ionicCapital(r, top, capH, lod, cap);
  } else {
    corinthianCapital(r, top, capH, lod, cap);
  }
  return { stone, cap };
}

/** An Ionic capital on a shaft of radius r topped at `top`: the echinus, the two bolsters with their volutes front and back, the thin abacus. */
function ionicCapital(r, top, capH, lod, out) {
  const seg = lod ? 10 : 20;
  out.push(revolve(profileOf([[r * 0.88, top], { arc: [r * 0.88, top + r * 0.32, r * 0.32, D(-90), D(0)], n: lod ? 2 : 4 }, [r * 1.12, top + r * 0.32], [0, top + r * 0.32]]), { segments: seg, metres: 1 }));
  const vy = top + r * 0.32;
  const vr = r * 0.36;
  // The bolsters (pulvini), along z, waisted by a band; their round ends are the volutes.
  for (const s of [-1, 1]) {
    const g = new CylinderGeometry(vr, vr, r * 2.0, seg, lod ? 1 : 3, false);
    if (!lod) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const t = Math.abs(p.getY(i)) / r;
        const k = t < 0.3 ? 0.78 : 1;
        p.setX(i, p.getX(i) * k);
        p.setZ(i, p.getZ(i) * k);
      }
    }
    g.rotateX(Math.PI / 2);
    g.translate(s * r * 0.98, vy, 0);
    out.push(tintGeometry(boxUV(g), () => 0.95));
    // The spiral cut on each face, a raised coil (only close up).
    if (lod === 0) {
      for (const f of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 26; k++) {
          const a = (k / 26) * Math.PI * 4.2;
          const rr = vr * (0.92 - (k / 26) * 0.75);
          pts.push([s * r * 0.98 + Math.cos(a) * rr * s, vy + Math.sin(a) * rr, f * (r * 1.0 + 0.004)]);
        }
        out.push(tube(pts, r * 0.045, { radial: 4, segments: 30, around: 0.1 }));
        const eye = new SphereGeometry(r * 0.09, 6, 4);
        eye.translate(s * r * 0.98, vy, f * r * 1.0);
        out.push(tintGeometry(boxUV(eye)));
      }
    }
  }
  // The channel between the volutes, front and back, and the abacus.
  out.push(box(r * 2.0, vr * 0.7, r * 2.0, 0, vy, 0, 0.92));
  out.push(slab(r * 2.5, capH - r * 0.32 - vr * 0.7 + 0.001, r * 2.2, { bevel: r * 0.04, wobble: 0, tone: 0, grime: 0 }).translate(0, vy + vr * 0.7, 0));
}

/** A Corinthian capital: a bell wrapped in two rows of acanthus, volutes at the corners under a concave abacus. */
function corinthianCapital(r, top, capH, lod, out) {
  const seg = lod ? 10 : 20;
  const bellTop = top + capH * 0.82;
  out.push(revolve(profileOf([[r * 0.86, top], [r * 0.9, top + capH * 0.4], [r * 1.02, top + capH * 0.7], [r * 1.12, bellTop], [0, bellTop]]), { segments: seg, metres: 1, tint: () => 0.9 }));
  if (lod === 0) {
    // Acanthus: each leaf a strip bent out from the bell, its tip curling over; eight low, eight tall between them.
    for (const [row, n, h0, h1, off] of [[0, 8, 0.0, 0.45, 0], [1, 8, 0.12, 0.72, Math.PI / 8]]) {
      for (let k = 0; k < n; k++) {
        out.push(acanthus(r, top, capH, h0, h1, off + (k / n) * Math.PI * 2, row));
      }
    }
    // The corner volutes (helices) under the abacus's horns.
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const pts = [];
      for (let j = 0; j <= 10; j++) {
        const t = j / 10;
        const rad = r * (0.9 + 0.45 * t);
        const y = top + capH * (0.55 + 0.32 * t) - (t > 0.75 ? (t - 0.75) * capH * 0.5 : 0);
        pts.push([Math.sin(a) * rad, y, Math.cos(a) * rad]);
      }
      out.push(tube(pts, r * 0.07, { radial: 4, segments: 10, around: 0.1 }));
    }
  }
  // The abacus: its sides hollowed (a square cut at the corners reads as much from a few metres).
  const ab = new BoxGeometry(r * 2.7, capH - (bellTop - top), r * 2.7, 2, 1, 2);
  const p = ab.attributes.position;
  for (let i = 0; i < p.count; i++) {
    // (The middle of each side pulled in: the concave abacus.)
    const x = p.getX(i);
    const z = p.getZ(i);
    if (Math.abs(x) < 1e-6) p.setZ(i, z * 0.82);
    if (Math.abs(z) < 1e-6) p.setX(i, x * 0.82);
  }
  ab.computeVertexNormals();
  ab.translate(0, bellTop + (capH - (bellTop - top)) / 2, 0);
  out.push(tintGeometry(boxUV(ab), () => 0.96));
  if (lod === 0) {
    // The flower (fleuron) in the middle of each face.
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const f = new SphereGeometry(r * 0.13, 6, 4);
      f.translate(Math.sin(a) * r * 1.12, bellTop + (capH - (bellTop - top)) / 2, Math.cos(a) * r * 1.12);
      out.push(tintGeometry(boxUV(f)));
    }
  }
}

/** One acanthus leaf on a Corinthian bell at angle a, from h0 to h1 of the capital's height, its tip curling out. */
function acanthus(r, top, capH, h0, h1, a, row) {
  const pos = [];
  const cols = 3;
  const rows = 4;
  const w = r * (row ? 0.42 : 0.48);
  const grid = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const y = top + capH * (h0 + (h1 - h0) * t);
    // Out from the bell, more toward the tip, which curls over and down.
    const out = r * (0.92 + 0.12 * t + (t > 0.7 ? (t - 0.7) * 0.9 : 0));
    const dy = t > 0.8 ? -(t - 0.8) * capH * 0.35 : 0;
    const ww = w * (1 - 0.65 * t * t);
    const line = [];
    for (let i = 0; i <= cols; i++) {
      const u = i / cols - 0.5;
      // The midrib stands proud; the lobes fall back to the bell.
      const lift = r * 0.06 * (1 - Math.abs(u) * 2);
      const side = u * ww * 2;
      const rr = out + lift;
      line.push([Math.sin(a) * rr + Math.cos(a) * side, y + dy, Math.cos(a) * rr - Math.sin(a) * side]);
    }
    grid.push(line);
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const p00 = grid[j][i];
      const p10 = grid[j][i + 1];
      const p01 = grid[j + 1][i];
      const p11 = grid[j + 1][i + 1];
      pos.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // (Built facing out from the bell: if it came out facing in, turn its faces.)
  const n = g.attributes.normal;
  if (n.getX(0) * Math.sin(a) + n.getZ(0) * Math.cos(a) < 0) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const x = p.getX(i + 1);
      const y = p.getY(i + 1);
      const z = p.getZ(i + 1);
      p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
      p.setXYZ(i + 2, x, y, z);
    }
    g.computeVertexNormals();
  }
  return tintGeometry(boxUV(g), (x, y) => 0.8 + 0.2 * smoothstep(top, top + capH, y));
}

/** Column places along a court's edge: every side of [x0, x1, z0, z1] from corner to corner, about `step` apart; `sides` which of 'fblr'. */
export function columnsRound(rect, step, sides = 'fblr') {
  const [x0, x1, z0, z1] = rect;
  const out = [];
  const key = (x, z) => `${x.toFixed(3)},${z.toFixed(3)}`;
  const seen = new Set();
  const add = (x, z) => {
    if (seen.has(key(x, z))) return;
    seen.add(key(x, z));
    out.push([x, z]);
  };
  const run = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(L / step));
    for (let k = 0; k <= n; k++) add(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n);
  };
  if (sides.includes('f')) run(x0, z1, x1, z1);
  if (sides.includes('b')) run(x0, z0, x1, z0);
  if (sides.includes('l')) run(x0, z0, x0, z1);
  if (sides.includes('r')) run(x1, z0, x1, z1);
  return out;
}

/** The architrave over a court's columns: a beam round [x0, x1, z0, z1] from y0 to y1 (sides as columnsRound), its face painted. */
export function architraveRound(rect, y0, y1, sides = 'fblr', w = 0.26) {
  const [x0, x1, z0, z1] = rect;
  const out = [];
  const h = y1 - y0;
  // (The front and back beams run the court's whole width; the sides fit between them.)
  if (sides.includes('f')) out.push(box(x1 - x0 + w, h, w, (x0 + x1) / 2, y0, z1, 0.95));
  if (sides.includes('b')) out.push(box(x1 - x0 + w, h, w, (x0 + x1) / 2, y0, z0, 0.95));
  const za = z0 + w / 2;
  const zb = z1 - w / 2;
  if (sides.includes('l')) out.push(box(w, h, zb - za, x0, y0, (za + zb) / 2, 0.95));
  if (sides.includes('r')) out.push(box(w, h, zb - za, x1, y0, (za + zb) / 2, 0.95));
  return out;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/**
 * A man in the toga (person() in white wool, a mantle over it, to the
 * ankles), at (x, y, z) facing ry: the broad purple stripe of a senator's
 * tunic down his front (latus clavus), the toga's fold across his chest
 * (the balteus) and, a magistrate's, its purple border (praetexta).
 * Returns person parts, the stripes in the dyed cloth.
 */
export function togate(mats, x, y, z, ry, { sit = 0, arms, praetexta = false, scale = 1, skin = 0xb08060, hair = 0x3a2a1c, beard = false, lean } = {}) {
  const parts = person(mats, { cloth: 0xf2ede2, cloth2: 0xf6f2ea, long: true, sit, arms, skin, hair, beard, ...(lean === undefined ? {} : { lean }) }, x, y, z, ry, scale);
  const place = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ry), new Vector3(scale, scale, scale));
  const seated = sit > 0;
  const dy = seated ? sit + 0.08 - 0.86 : 0;
  const extra = [];
  // The fold of the toga from the left shoulder across the chest to the right hip.
  const fold = tube([[-0.17, 1.38 + dy, 0.06], [-0.02, 1.2 + dy, 0.17], [0.14, 1.02 + dy, 0.14], [0.2, 0.94 + dy, 0.02]], 0.045, { radial: 5, segments: 8, around: 0.1 });
  extra.push(tintGeometry(fold, () => lin(0xece6da)));
  // The stripe down the front of the tunic, seen at the neck under the fold.
  extra.push(box(0.05, 0.16, 0.012, 0.06, 1.27 + dy, 0.155, () => PURPLE));
  if (praetexta) {
    // The toga's purple border along the fold's edge.
    const edge = tube([[-0.16, 1.4 + dy, 0.08], [-0.01, 1.23 + dy, 0.2], [0.16, 1.03 + dy, 0.17]], 0.016, { radial: 4, segments: 8, around: 0.1 });
    extra.push(tintGeometry(edge, () => PURPLE));
  }
  for (const g of extra) parts.push({ g: g.applyMatrix4(place), material: mats.cloth });
  return parts;
}

/**
 * A lictor (a magistrate's attendant) at (x, y, z) facing ry, the fasces on
 * his left shoulder: elm rods bound in red thongs round an axe. Returns
 * person parts (the rods in wood, the axe's head in iron).
 */
export function lictor(mats, x, y, z, ry) {
  const parts = person(mats, { cloth: 0xa8322b, cloth2: null, skin: 0xa07050, hair: 0x2a1e14, arms: 'hold' }, x, y, z, ry);
  const place = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ry), new Vector3(1, 1, 1));
  // The bundle rests against his left shoulder, its foot in his hands.
  const local = [];
  const a = [-0.14, 1.05, 0.26];
  const b = [-0.22, 1.85, -0.02];
  for (let k = 0; k < (5); k++) {
    const ox = ((k % 3) - 1) * 0.022;
    const oz = (Math.floor(k / 3) - 0.5) * 0.022;
    local.push([staff([a[0] + ox, a[1], a[2] + oz], [b[0] + ox, b[1], b[2] + oz], 0.013, 5), mats.wood]);
  }
  for (const t of [0.25, 0.55, 0.85]) {
    const c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const g = new CylinderGeometry(0.05, 0.05, 0.03, 8, 1);
    g.rotateX(-Math.atan2(b[2] - a[2], b[1] - a[1]));
    g.translate(c[0], c[1], c[2]);
    local.push([tintGeometry(boxUV(g), () => lin(0x8a1c18)), mats.cloth]);
  }
  const axe = new BoxGeometry(0.012, 0.12, 0.14);
  axe.translate(b[0] - 0.02, b[1] - 0.05, b[2] - 0.07);
  local.push([tintGeometry(boxUV(axe)), mats.iron]);
  for (const [g, m] of local) parts.push({ g: g.applyMatrix4(place), material: m });
  return parts;
}

/** A household slave or a freedman at (x, y, z) facing ry: a tunic of undyed or faded wool. */
export function servant(mats, x, y, z, ry, { cloth = 0x9c8a6a, arms = 'down', skin = 0x9a6c4c, hair = 0x241a12, long = false } = {}) {
  return person(mats, { cloth, cloth2: null, skin, hair, arms, long }, x, y, z, ry);
}

/** A Roman lady in a long stola and a coloured palla over it, at (x, y, z) facing ry. */
export function matron(mats, x, y, z, ry, { cloth = 0xe6d8bc, palla = 0x4f6f86, sit = 0, arms } = {}) {
  return person(mats, { cloth, cloth2: palla, long: true, skin: 0xc49272, hair: 0x2c1a10, sit, arms }, x, y, z, ry, 0.95);
}

// ---------------------------------------------------------------------------
// Statues
// ---------------------------------------------------------------------------

/**
 * A standing figure's mass for the middle distance (a statue, Victory, a
 * guard far off): a draped body turned from a profile and a head, a few
 * hundred triangles where person() is fifteen hundred. Its foot at
 * (x, y, z), `s` its scale. Returns geometries.
 */
export function figureMass(x, y, z, s = 1, lod = 1) {
  const seg = lod === 2 ? 5 : 9;
  const body = revolve(profileOf([[0.2, 0], [0.21, 0.08], [0.19, 0.6], [0.16, 0.98], [0.19, 1.2], [0.2, 1.33], [0.15, 1.42], [0.05, 1.47], [0, 1.47]].map(([r, y]) => [r * s, y * s])), { segments: seg, metres: 0.5 });
  body.scale(1, 1, 0.72);
  body.translate(x, y, z);
  const head = new SphereGeometry(0.1 * s, seg, Math.max(4, seg - 3));
  head.scale(0.92, 1.12, 1);
  head.translate(x, y + 1.6 * s, z);
  return [body, tintGeometry(boxUV(head))];
}

/**
 * A statue on an inscribed pedestal at (x, z), facing ry: a figure in
 * marble or bronze (`mat`: the statue's one material; a person's cloth,
 * skin and hair all of it). `kind`: 'togate' (an honoured citizen),
 * 'draped' (a goddess, a muse), 'nude' (an athlete, a god). Returns
 * { base: [geos], statue: [geos] }.
 */
export function statue(x, z, ry, { y0 = 0, h = 1.1, kind = 'togate', lod = 0, scale = 1, base = 0.55, arms } = {}) {
  const out = { base: [], statue: [] };
  const w = 0.62 * scale;
  out.base.push(slab(w + 0.12, 0.12, w + 0.12, { bevel: 0.015, seed: 3, wobble: 0, tone: 0, grime: 0.3 }).translate(x, y0, z));
  out.base.push(slab(w, h * base, w, { bevel: 0.01, seed: 4, wobble: 0, tone: 0, grime: 0.1 }).translate(x, y0 + 0.12, z));
  out.base.push(slab(w + 0.1, 0.09, w + 0.1, { bevel: 0.015, seed: 5, wobble: 0, tone: 0, grime: 0 }).translate(x, y0 + 0.12 + h * base, z));
  const top = y0 + 0.21 + h * base;
  if (lod === 2) {
    out.statue.push(tintGeometry(boxUV(new CylinderGeometry(0.13 * scale, 0.2 * scale, 1.6 * scale, 6, 1).translate(x, top + 0.8 * scale, z))));
    return out;
  }
  if (lod === 1) {
    out.statue.push(...figureMass(x, top, z, 1.06 * scale));
    return out;
  }
  const one = { cloth: 'statue', skin: 'statue', hair: 'statue', leather: 'statue' };
  const opts = kind === 'togate'
    ? { cloth: 0xf0f0f0, cloth2: 0xf6f6f6, long: true, arms: arms || 'orate' }
    : kind === 'draped' ? { cloth: 0xf0f0f0, cloth2: 0xf6f6f6, long: true, arms: arms || 'hold' }
      : { cloth: 0xf0f0f0, cloth2: null, long: false, arms: arms || 'down' };
  for (const p of person(one, opts, x, top, z, ry, 1.06 * scale)) out.statue.push(p.g);
  return out;
}

/**
 * Victory (Nike) standing on a globe, her wings spread, a wreath held up in
 * her right hand: the statue the Senate set up in its house, and the one on
 * the Curia Julia's gable on Octavian's coins. Her foot at (x, y, z),
 * facing +z, `s` her scale. Returns geometries for the gilt.
 */
export function victory(x, y, z, s = 1, lod = 0) {
  const out = [];
  const globe = new SphereGeometry(0.28 * s, lod ? 10 : 18, lod ? 7 : 12);
  globe.translate(x, y + 0.26 * s, z);
  out.push(tintGeometry(boxUV(globe), () => 0.95));
  const foot = y + 0.5 * s;
  if (lod === 2) {
    out.push(tintGeometry(boxUV(new CylinderGeometry(0.1 * s, 0.17 * s, 1.5 * s, 6, 1).translate(x, foot + 0.75 * s, z))));
    return out;
  }
  const one = { cloth: 'g', skin: 'g', hair: 'g', leather: 'g' };
  if (lod === 1) out.push(...figureMass(x, foot, z, s));
  else for (const p of person(one, { cloth: 0xffffff, cloth2: null, long: true, arms: 'orate' }, x, foot, z, 0, s)) out.push(p.g);
  // The wreath in her raised right hand.
  const wreath = new TorusGeometry(0.09 * s, 0.018 * s, 4, lod ? 8 : 14);
  wreath.translate(x + 0.32 * s, foot + 1.74 * s, z + 0.38 * s);
  out.push(tintGeometry(boxUV(wreath)));
  // The wings: two feathered sheets swept up and back from her shoulders.
  for (const side of [-1, 1]) {
    const pos = [];
    const cols = lod ? 3 : 6;
    const rows = 2;
    const P = (u, v) => {
      // u along the wing out from the shoulder, v across it (leading edge to the feathers' tips).
      const reach = 0.85 * s * u;
      const lift = (0.55 * u - 0.1 * u * u) * s;
      const back = (-0.12 - 0.22 * u) * s;
      const drop = v * (0.45 - 0.25 * u) * s;
      return [x + side * (0.1 * s + reach * 0.8), foot + 1.38 * s + lift - drop, z + back - v * 0.08 * s];
    };
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const a = P(i / cols, j / rows);
        const b = P((i + 1) / cols, j / rows);
        const c = P((i + 1) / cols, (j + 1) / rows);
        const d = P(i / cols, (j + 1) / rows);
        pos.push(...a, ...b, ...c, ...a, ...c, ...d);
        pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    out.push(tintGeometry(boxUV(g), () => 0.92));
  }
  return out;
}

/**
 * The governor's standard: a tall pole with a gilt finial and a cross-bar
 * from which hangs a square of purple cloth fringed in gold, at (x, z) on
 * y0, `h` tall. Returns { wood, gilt, cloth }.
 */
export function standard(x, z, y0, h, lod = 0, { w = 0.7, hc = 0.78, colour = PURPLE, face = 1 } = {}) {
  const out = { wood: [], gilt: [], cloth: [] };
  out.wood.push(box(0.05, h, 0.05, x, y0, z, 0.7));
  out.gilt.push(box(0.12, 0.1, 0.12, x, y0, z, 0.9));
  const top = y0 + h;
  const fin = new SphereGeometry(0.05, lod ? 6 : 10, lod ? 4 : 6);
  fin.translate(x, top + 0.07, z);
  out.gilt.push(tintGeometry(boxUV(fin)));
  if (lod === 0) out.gilt.push(tintGeometry(boxUV(new ConeGeometry(0.03, 0.14, 6).translate(x, top + 0.18, z))));
  const by = top - 0.08;
  out.gilt.push(box(w + 0.12, 0.035, 0.035, x, by, z, 0.9));
  // The cloth: a little sagging and stirring, its border gold.
  const seg = lod === 0 ? 8 : 2;
  const g = new BoxGeometry(w, hc, 0.008, seg, seg, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / w + 0.5;
    const v = 0.5 - p.getY(i) / hc;
    p.setZ(i, p.getZ(i) + Math.sin(u * Math.PI * 2 + v * 1.5) * 0.03 * (0.3 + v));
  }
  g.computeVertexNormals();
  g.translate(x, by - hc / 2 - 0.02, z + face * 0.03);
  out.cloth.push(tintGeometry(boxUV(g), (gx, gy) => {
    const u = Math.abs(gx - x) / (w / 2);
    const v = Math.abs(gy - (by - hc / 2 - 0.02)) / (hc / 2);
    return u > 0.86 || v > 0.88 ? GOLD : colour;
  }));
  if (lod === 0) for (let k = 0; k < 11; k++) out.cloth.push(box(0.022, 0.07, 0.008, x - w / 2 + (k + 0.5) * (w / 11), by - hc - 0.09, z + face * 0.03, () => GOLD));
  return out;
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

/**
 * An impluvium: a shallow marble-rimmed basin sunk in the floor at (x, z),
 * w x d, its rim's top at y; the water a few centimetres under the rim.
 * Returns { rim, floor, water }.
 */
export function impluvium(x, z, w, d, y, lod = 0) {
  const t = 0.16;
  const rim = [];
  for (const s of [-1, 1]) {
    rim.push(slab(w, 0.14, t, { bevel: 0.02, seed: 11 + s, wobble: 0, tone: 0.02, grime: 0.1 }).translate(x, y - 0.14, z + s * (d / 2 - t / 2)));
    rim.push(slab(t, 0.14, d - 2 * t, { bevel: 0.02, seed: 13 + s, wobble: 0, tone: 0.02, grime: 0.1 }).translate(x + s * (w / 2 - t / 2), y - 0.14, z));
  }
  const floor = [box(w - 2 * t, 0.02, d - 2 * t, x, y - 0.16, z, 0.7)];
  const water = [box(w - 2 * t + 0.01, 0.01, d - 2 * t + 0.01, x, y - 0.06, z)];
  return { rim, floor, water };
}

/**
 * A fountain's jet: water thrown up `h` from a nozzle at (x, y, z) and
 * falling back in an arch round it into the basin at yWater (`n` streams
 * spread round, like a sprinkled crown), and the rings it makes there.
 * Returns { stream, rings }.
 */
export function jet(x, y, z, h, yWater, lod = 0, { n = 1, spread = 0.18, r = 0.018 } = {}) {
  const stream = [];
  const rings = [];
  const count = lod ? Math.min(n, 2) : n;
  for (let k = 0; k < count; k++) {
    const a = (k / Math.max(1, count)) * Math.PI * 2 + 0.4;
    const dx = Math.cos(a) * spread;
    const dz = Math.sin(a) * spread;
    // Up and over: a parabola through the nozzle, the top, and the landing point.
    const pts = [];
    const m = lod ? 8 : 16;
    for (let j = 0; j <= m; j++) {
      const t = j / m;
      const yy = y + 4 * h * t * (1 - t) * (t < 0.5 ? 1 : 1) - (yWater < y ? (y - yWater) * t * t : 0);
      pts.push([x + dx * t * 2, yy, z + dz * t * 2]);
    }
    const g = tube(pts, r, { radial: lod ? 5 : 8, segments: lod ? 8 : 18, around: 0.05 });
    stream.push(g);
    rings.push(ripples(x + dx * 2, yWater + 0.004, z + dz * 2, 0.012, 0.22, lod));
  }
  return { stream, rings };
}

/** A flat ring on the water round (x, z), inner to outer radius, fading at its edges (its v outward: ringMaterial scrolls it). */
export function ripples(x, y, z, inner, outer, lod = 0) {
  const seg = lod ? 14 : 32;
  const rings = lod ? 2 : 4;
  const pos = [];
  const uv = [];
  const idx = [];
  const col = [];
  for (let j = 0; j <= rings; j++) {
    const rr = inner + ((outer - inner) * j) / rings;
    const alpha = smoothstep(inner, inner + 0.03, rr) * (1 - smoothstep(outer * 0.45, outer, rr));
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      pos.push(x + Math.cos(a) * rr, y, z + Math.sin(a) * rr);
      uv.push((k / seg) * 1.2, rr * 2.4);
      col.push(1, 1, 1, alpha);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let k = 0; k < seg; k++) {
      const a = j * (seg + 1) + k;
      const b = a + seg + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 4));
  g.computeVertexNormals();
  return g;
}

/**
 * A marble labrum: a round basin on a fluted foot at (x, z), its rim at
 * `top`, radius R, standing in a pool or on the ground at y0. Returns
 * { marble, water (the bowl's surface), y (the water's level) }.
 */
export function labrum(x, z, y0, top, R, lod = 0) {
  const seg = lod === 2 ? 10 : lod ? 18 : 36;
  const foot = revolve(profileOf([[R * 0.42, y0], [R * 0.38, y0 + 0.06], [R * 0.2, y0 + 0.14], [R * 0.16, top - 0.3], [R * 0.3, top - 0.24], [0, top - 0.24]]), { segments: lod ? 10 : 20, metres: 1 });
  const bowl = revolve(profileOf([[R * 0.3, top - 0.26], [R * 0.8, top - 0.16], [R, top - 0.04], [R * 1.02, top], [R * 0.95, top + 0.01], [R * 0.92, top - 0.04], [0, top - 0.06]]), { segments: seg, metres: 1, tint: (p) => 0.86 + 0.14 * smoothstep(top - 0.2, top, p.y) });
  foot.translate(x, 0, z);
  bowl.translate(x, 0, z);
  const water = new CylinderGeometry(R * 0.92, R * 0.92, 0.01, seg, 1);
  water.translate(x, top - 0.05, z);
  return { marble: [foot, bowl], water: [tintGeometry(boxUV(water))], y: top - 0.045 };
}

/** A round pool's kerb at (x, z), radius R, kerb `h` high, its water `dw` under the kerb's top. Returns { stone, water, y }. */
export function roundPool(x, z, R, h, lod = 0, dw = 0.08) {
  const seg = lod === 2 ? 12 : lod ? 24 : 48;
  const kerb = revolve(profileOf([[R + 0.1, 0], [R + 0.1, h - 0.04], [R + 0.06, h], [R - 0.12, h], [R - 0.14, h - 0.04], [R - 0.14, 0.02], [0, 0.02]]), { segments: seg, metres: 1, tint: (p) => (p.y < 0.05 ? 0.7 : 0.92) });
  kerb.translate(x, 0, z);
  const water = new CylinderGeometry(R - 0.13, R - 0.13, 0.01, seg, 1);
  water.translate(x, h - dw, z);
  return { stone: [kerb], water: [tintGeometry(boxUV(water))], y: h - dw + 0.005 };
}

// ---------------------------------------------------------------------------
// The garden
// ---------------------------------------------------------------------------

/** Flowers over a bed (x0..x1, z0..z1) at y: small heads in roses' and lilies' colours. Returns geometries for the flowers material. */
export function flowerBed(x0, x1, z0, z1, y, seed, lod = 0, n = 24) {
  if (lod === 2) return [];
  const rnd = artRng(seed);
  const out = [];
  const colours = [lin(0xc8343a), lin(0xe8dcd0), lin(0xd06a8a), lin(0xe0b040), lin(0x8a5aa8)];
  const count = lod ? Math.ceil(n / 3) : n;
  for (let k = 0; k < count; k++) {
    const x = x0 + rnd() * (x1 - x0);
    const z = z0 + rnd() * (z1 - z0);
    const c = colours[Math.floor(rnd() * colours.length)];
    const g = new SphereGeometry(0.06 + rnd() * 0.03, lod ? 4 : 6, lod ? 3 : 4);
    g.scale(1, 0.7, 1);
    g.translate(x, y + 0.28 + rnd() * 0.12, z);
    out.push(tintGeometry(boxUV(g), () => c));
  }
  return out;
}

/** Leafy clumps for a bed (x0..x1, z0..z1) at y (acanthus, myrtle): a row of low bushes. Returns leaf geometries. */
export function bedPlants(x0, x1, z0, z1, y, seed, lod = 0) {
  const out = [];
  const L = Math.max(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(L / (lod ? 1.2 : 0.7)));
  const alongX = x1 - x0 >= z1 - z0;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const x = alongX ? x0 + (x1 - x0) * t : (x0 + x1) / 2;
    const z = alongX ? (z0 + z1) / 2 : z0 + (z1 - z0) * t;
    out.push(...bush(x, y + 0.27, z, 0.28, { lod, seed: seed + k, squash: 0.8 }));
  }
  return out;
}

/** Clipped box round a bed's edge (x0..x1, z0..z1) at y, `h` high. Returns leaf geometries. */
export function boxEdging(x0, x1, z0, z1, y, h, lod = 0, seed = 1) {
  const t = 0.22;
  const out = [];
  for (const g of [
    ...hedge(x0, x1, z1 - t, z1, h, { lod, seed }),
    ...hedge(x0, x1, z0, z0 + t, h, { lod, seed: seed + 1 }),
    ...hedge(x0, x0 + t, z0 + t, z1 - t, h, { lod, seed: seed + 2 }),
    ...hedge(x1 - t, x1, z0 + t, z1 - t, h, { lod, seed: seed + 3 }),
  ]) out.push(g.translate(0, y, 0));
  return out;
}

/** A small tree in the garden (a bay, a lemon in a pot or in the ground) at (x, y, z): a trunk and a lumpy crown. Returns { wood, leaf }. */
export function gardenTree(x, y, z, h, lod = 0, seed = 1) {
  const wood = [tintGeometry(boxUV(new CylinderGeometry(0.05, 0.08, h * 0.55, lod ? 5 : 8, 1).translate(x, y + h * 0.275, z)), () => 0.55)];
  const leaf = bush(x, y + h * 0.68, z, h * 0.3, { lod, seed, squash: 1.0 });
  return { wood, leaf };
}

/** A person's parts added to TaggedParts `p` under `name` in state `when` (castra.js people). */
export function addPeople(p, mats, name, list, when) {
  people(p, mats, name, list, when);
}

/** A point of a figure's frame in the model's (learning.js at). */
export { at };
