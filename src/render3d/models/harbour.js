/**
 * models/harbour.js
 * ----------------------------------------------------------------------------
 * What the fleet's three buildings share (the Navalia, the Statio and the
 * Portus: navalia.js, statio.js, portus.js), from Roman harbour works and
 * ships as they are known, not from the 2D sprites:
 *
 *   - timber piles driven into the bed, wet and weedy at the waterline, a
 *     ring of foam where the water laps them (pile, pileFoam)
 *   - opus pilarum: piers of harbour concrete (pozzolana, which sets under
 *     water, Vitruvius book V) faced in tufa, joined by brick arches that
 *     carry the quay and let the water through, as at Puteoli and Baiae
 *     (arcade)
 *   - stone bollards, iron mooring rings, steps down to the water
 *   - the liburnian: the light two-banked warship of the provincial fleets,
 *     built shell first as Graeco-Roman hulls were (keel and posts, then the
 *     strakes edge-joined with mortise and tenon, the frames fitted inside
 *     the shell after), pitched below and painted above, a bronze ram at the
 *     waterline like the one found off Athlit, an eye on the bow, the stern
 *     curling up and forward (liburnianHull)
 *   - oars, racks of them, and a seated rower pulling one (rower)
 *
 * Every model of the three is built facing +z, the water side, its middle
 * at the origin, y up: the land row behind the shore line (z < SHORE_Z),
 * the two rows standing out over the water before it, as the game places
 * a 3 x 3 waterside building (sim/entities.js waterRowsFor). The water's
 * surface is y = 0, as the land's: what is under it is clipped by the look
 * (materials.js uLookClipY), so a pile simply goes down into the water.
 * ----------------------------------------------------------------------------
 */

import {
  BufferGeometry, Float32BufferAttribute, CylinderGeometry, BoxGeometry, SphereGeometry, CapsuleGeometry, TorusGeometry,
  Vector3, Quaternion,
} from 'three';
import { revolve, profileOf, boxUV, tintGeometry, tube, merge } from '../shapes.js';
import { material } from '../materials.js';
import { artRng, smoothstep } from '../texgen.js';
import { slab, wallWithOpenings } from './masonry.js';
import { lin } from './rural.js';

const D = (deg) => (deg * Math.PI) / 180;

/** The measures every fleet building shares (metres). */
export const HARBOUR = Object.freeze({
  half: 6, // a 3 x 3 footprint: 12 m
  shore: -2, // the shore line: land behind it (one row), the water's two rows before it
  deckY: 0.62, // a timber deck's top over the water
  quayY: 0.86, // a stone quay's top
});

/** The materials of the harbour parts (materials.js caches by key: shared with the town's). */
export function harbourMaterials() {
  return {
    wood: material('wood', { surface: 'wood', vertexColors: true, snow: 1 }),
    stone: material('limestone', { surface: 'limestone', vertexColors: true, snow: 1 }),
    trav: material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 }),
    tufa: material('tufa', { surface: 'tufa', vertexColors: true, snow: 1 }),
    brick: material('brick', { surface: 'brick', vertexColors: true, snow: 1 }),
    tile: material('roof-tile', { surface: 'terracotta', vertexColors: true, snow: 1 }),
    iron: material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }),
    bronze: material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }),
    rope: material('rope', { surface: 'rope', vertexColors: true, snow: 0.6, normal: 1 }),
    plaster: material('plaster', { surface: 'plaster', vertexColors: true, snow: 1 }),
    red: material('stucco-red', { surface: 'plaster', color: 0xc0644a, vertexColors: true, snow: 1 }),
    // A hull's paint over its planks (encaustic: pigment in wax), Rome's red; the pitch below is the wood's own vertex colour.
    paint: material('hull-paint', { surface: 'wood', color: 0xd25a3c, vertexColors: true, snow: 1 }),
    gilt: material('hull-gilt', { surface: 'bronze', color: 0xf0c060, vertexColors: true, snow: 0.7 }),
    linen: material('sail-linen', { surface: 'wool', color: 0xe9e1cc, vertexColors: true, snow: 0.9 }),
    dark: material('room-dark', { color: 0x0e0b09, roughness: 1, snow: 0, wet: 0 }),
    // Foam where the water laps a pile or a pier (see-through, fading out by its vertex alpha).
    foam: material('lap-foam', { color: 0xeef3f1, roughness: 0.6, opacity: 0.4, snow: 0, wet: 0 }),
    // The eye on the bow, and the pupil (flat colours).
    white: material('paint-white', { color: 0xece6d8, roughness: 0.6, snow: 0.5 }),
    black: material('paint-black', { color: 0x1a1d22, roughness: 0.5, snow: 0.5 }),
    ember: material('beacon-ember', { color: 0x5a2a10, roughness: 0.9, emissive: 0xff7a2a, emissiveIntensity: 1.6, snow: 0, wet: 0 }),
  };
}

// ---------------------------------------------------------------------------
// Timber: swept beams, boards with their grain along them, piles
// ---------------------------------------------------------------------------

const _t = new Vector3();
const _s = new Vector3();
const _n = new Vector3();
const _r = new Vector3();

/**
 * A squared timber swept along `points` ([x, y, z]): `w` wide along `side`
 * (a direction kept square to the run), `h` deep the other way, narrowing to
 * `taper` of that at the end. UVs in metres with v along the run (the
 * wood's grain), each face its own vertices (crisp arrises). `ends`: close
 * the two ends.
 */
export function sweep(points, w, h, { side = [1, 0, 0], taper = 1, ends = true, tint = null } = {}) {
  const n = points.length;
  const P = points.map((p) => new Vector3(p[0], p[1], p[2]));
  const rings = [];
  let along = 0;
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(n - 1, i + 1)];
    _t.subVectors(b, a).normalize();
    _r.set(side[0], side[1], side[2]);
    _s.copy(_r).addScaledVector(_t, -_r.dot(_t));
    if (_s.lengthSq() < 1e-8) _s.set(0, 1, 0).addScaledVector(_t, -_t.y);
    _s.normalize();
    _n.crossVectors(_t, _s).normalize();
    if (i) along += P[i].distanceTo(P[i - 1]);
    const k = 1 + (taper - 1) * (i / Math.max(1, n - 1));
    const hw = (w / 2) * k;
    const hh = (h / 2) * k;
    const c = (sw, sh) => P[i].clone().addScaledVector(_s, sw * hw).addScaledVector(_n, sh * hh);
    rings.push({ v: along, q: [c(1, 1), c(1, -1), c(-1, -1), c(-1, 1)], hw, hh });
  }
  const pos = [];
  const uv = [];
  const idx = [];
  // The four faces, each a strip of its own: (corner a, corner b) round the section.
  for (let f = 0; f < 4; f++) {
    const base = pos.length / 3;
    const a = f;
    const b = (f + 1) % 4;
    for (const r of rings) {
      const wa = f % 2 ? r.hw * 2 : r.hh * 2;
      pos.push(r.q[a].x, r.q[a].y, r.q[a].z, r.q[b].x, r.q[b].y, r.q[b].z);
      uv.push(0, r.v, wa, r.v);
    }
    for (let i = 0; i < n - 1; i++) {
      const p = base + i * 2;
      idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
    }
  }
  if (ends) {
    for (const [r, flip] of [[rings[0], true], [rings[n - 1], false]]) {
      const base = pos.length / 3;
      for (const q of r.q) pos.push(q.x, q.y, q.z);
      uv.push(0, 0, 0, r.hh * 2, r.hw * 2, r.hh * 2, r.hw * 2, 0);
      if (flip) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  // (The frame (side, run x side, run) is right-handed by construction: every face winds outward.)
  g.computeVertexNormals();
  return tintGeometry(g, tint);
}

/** A sawn board or squared beam, w (x) x h (y) x d (z), its foot centred on the origin, its grain along its longest side. */
export function board(w, h, d, { tone = 1, grime = 0 } = {}) {
  const g = new BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const long = w >= d && w >= h ? 0 : d >= h ? 2 : 1;
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const face = n[0] > 0.5 ? 0 : n[1] > 0.5 ? 1 : 2;
    // v along the long axis where the face holds it; across the other axis of the face for u.
    const other = [0, 1, 2].find((ax) => ax !== face && ax !== long);
    if (face === long) {
      const [u0, v0] = [0, 1, 2].filter((ax) => ax !== face);
      uv[i * 2] = p[u0];
      uv[i * 2 + 1] = p[v0];
    } else {
      uv[i * 2] = p[other];
      uv[i * 2 + 1] = p[long];
    }
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return tintGeometry(g, (x, y) => tone * (1 - grime * (1 - Math.min(1, y / Math.max(0.05, Math.min(h, 0.3)))) ** 2));
}

/**
 * A timber pile driven into the bed at (x, z), standing to `top`: round,
 * its head cut square, dark and wet below the tide line, green with weed
 * at the waterline (its foot is under the water, which the look clips).
 */
export function pile(x, z, top, { r = 0.11, seed = 1, lod = 0 } = {}) {
  const rnd = artRng(seed);
  const seg = lod === 0 ? 10 : lod === 1 ? 6 : 4;
  const rr = r * (0.9 + rnd() * 0.2);
  const tone = 0.85 + rnd() * 0.2;
  const g = revolve(profileOf([[rr * 1.04, -0.4], [rr * 1.03, 0.06], { sharp: true }, [rr, 0.07], [rr, 0.4], { sharp: true }, [rr * 0.99, 0.41], [rr * 0.94, top], [0, top]]), {
    segments: seg,
    metres: 1,
    tint: (p) => (p.y < 0.065 ? lin(0x56634a, 1.4) : p.y < 0.405 ? 0.5 * tone : tone * (0.85 + 0.15 * smoothstep(0.4, 1.2, p.y))),
  });
  // A little out of plumb: no two piles were driven alike.
  g.rotateZ((rnd() - 0.5) * 0.03);
  g.rotateX((rnd() - 0.5) * 0.03);
  return g.translate(x, 0, z);
}

/**
 * Foam lapping round a pile or a pier's foot on the water: a flat ring from
 * `r0` out to `r1` (or a rectangle's outline grown by `r1` round
 * x0..x1, z0..z1), fading out by its vertex alpha. For the `foam` material.
 */
export function pileFoam(x, z, r0, r1, seed = 1, lod = 0) {
  const seg = lod ? 10 : 18;
  const rnd = artRng(seed);
  const pos = [];
  const col = [];
  const idx = [];
  const wav = [rnd() * 6, rnd() * 6];
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    const w = 1 + 0.25 * Math.sin(a * 3 + wav[0]) + 0.15 * Math.sin(a * 5 + wav[1]);
    for (const [rad, al] of [[r0, 0.9], [r0 + (r1 - r0) * 0.35 * w, 0.55], [r0 + (r1 - r0) * w, 0]]) {
      pos.push(x + Math.cos(a) * rad, 0.012, z + Math.sin(a) * rad);
      col.push(1, 1, 1, al);
    }
  }
  for (let k = 0; k < seg; k++) {
    for (let j = 0; j < 2; j++) {
      const a = k * 3 + j;
      const b = a + 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return flatRGBA(pos, col, idx);
}

/** Foam along the foot of a rectangular pier (x0..x1, z0..z1) out to `out` metres. */
export function pierFoam(x0, x1, z0, z1, out, seed = 1, lod = 0) {
  const rnd = artRng(seed);
  const pos = [];
  const col = [];
  const idx = [];
  // Round the outline in steps, each point pushed out along its corner's diagonal or its side's normal.
  const pts = [];
  const step = lod ? 0.5 : 0.25;
  const side = (ax, az, bx, bz, nx, nz) => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, nx, nz]);
  };
  side(x0, z1, x1, z1, 0, 1);
  side(x1, z1, x1, z0, 1, 0);
  side(x1, z0, x0, z0, 0, -1);
  side(x0, z0, x0, z1, -1, 0);
  const N = pts.length;
  for (let k = 0; k <= N; k++) {
    const [px, pz, nx, nz] = pts[k % N];
    const w = 0.7 + 0.6 * rnd();
    for (const [d, al] of [[0.0, 0.85], [out * 0.4 * w, 0.5], [out * w, 0]]) {
      pos.push(px + nx * d, 0.012, pz + nz * d);
      col.push(1, 1, 1, al);
    }
  }
  for (let k = 0; k < N; k++) {
    for (let j = 0; j < 2; j++) {
      const a = k * 3 + j;
      const b = a + 3;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  return flatRGBA(pos, col, idx);
}

/** A flat geometry facing up from points, RGBA colours and an index (UVs in metres). */
function flatRGBA(pos, col, idx) {
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 4));
  const uv = [];
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i], pos[i + 2]);
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  // (Facing up whichever way the index winds.)
  const nor = g.attributes.normal;
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
  return g;
}

/**
 * A deck of planks over x0..x1, z0..z1 at height `y` (its top), the planks
 * running along `along` ('x' or 'z'), each its own tone, a gap between
 * them; under it the bearers across the planks. Returns geometries (wood).
 */
export function deck(x0, x1, z0, z1, y, { along = 'z', seed = 1, lod = 0, plank = 0.26, t = 0.06, bearers = 1.3 } = {}) {
  const rnd = artRng(seed);
  const out = [];
  const alongZ = along === 'z';
  const across0 = alongZ ? x0 : z0;
  const across1 = alongZ ? x1 : z1;
  const len0 = alongZ ? z0 : x0;
  const len1 = alongZ ? z1 : x1;
  if (lod === 2) {
    out.push(board(x1 - x0, t, z1 - z0, { tone: 0.9 }).translate((x0 + x1) / 2, y - t, (z0 + z1) / 2));
    return out;
  }
  const w = lod ? plank * 2 : plank;
  for (let a = across0; a < across1 - 0.02; a += w) {
    const b = Math.min(across1, a + w) - 0.012;
    // A plank's run: at full detail broken into lengths with butt joints.
    let p = len0;
    while (p < len1 - 0.02) {
      const q = lod ? len1 : Math.min(len1, p + 2.2 + rnd() * 2.2);
      const tone = 0.78 + rnd() * 0.3;
      const g = alongZ ? board(b - a, t, q - p - 0.01, { tone }) : board(q - p - 0.01, t, b - a, { tone });
      out.push(g.translate(alongZ ? (a + b) / 2 : (p + q) / 2, y - t, alongZ ? (p + q) / 2 : (a + b) / 2));
      p = q;
    }
  }
  // Bearers under the planks, across them.
  for (let p = len0 + 0.15; p < len1; p += bearers) {
    const g = alongZ ? board(across1 - across0, 0.16, 0.14, { tone: 0.6 }) : board(0.14, 0.16, across1 - across0, { tone: 0.6 });
    out.push(g.translate(alongZ ? (across0 + across1) / 2 : p, y - t - 0.16, alongZ ? p : (across0 + across1) / 2));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stone: opus pilarum, bollards, rings, steps
// ---------------------------------------------------------------------------

/**
 * An arcade of opus pilarum: piers of concrete faced in tufa standing in
 * the water, joined by brick arches that carry the quay (`top`) and let
 * the water through. It runs along x from x0 to x1 (or along z: `along`),
 * `thick` through (its middle at `at` on the other axis), with `n` arches.
 * Returns { tufa, brick, trav } geometries: the piers and spandrels, the
 * arches' rings, the quay's edge stones along the top.
 */
export function arcade(a0, a1, at, thick, top, { along = 'x', span: want = 1.0, pier: pw = 0.7, seed = 1, lod = 0, spring = 0.05, kerb = true } = {}) {
  const L = a1 - a0;
  // As many arches of about `want` as fit between piers of about `pw`, a pier at each end.
  const n = Math.max(1, Math.round((L - pw) / (want + pw)));
  const pier = Math.min(pw, L / (n * 2.2 + 1));
  const span = (L - pier * (n + 1)) / n;
  const r = span / 2;
  const openings = [];
  for (let k = 0; k < n; k++) {
    const x = -L / 2 + pier * (k + 1) + span * (k + 0.5);
    // (From under the water, 0.4 m down, up to the springing, then the round head.)
    openings.push({ x, w: span, h: spring + 0.4, y: 0.1, arch: true });
  }
  const h = top - 0.12 + 0.5;
  const body = wallWithOpenings(L, h, thick, openings, { lod, y0: -0.5 });
  boxUV(body);
  // The piers darker and greener toward the water, the tide's line on them.
  tintGeometry(body, (x, y) => (y < 0.08 ? 0.55 : y < 0.3 ? 0.72 : 0.92 + 0.08 * smoothstep(0.3, 0.8, y)));
  const place = (g) => {
    // Built in x-y with its depth toward -z: centred on its thickness, then turned onto its axis.
    g.translate(0, 0, thick / 2);
    if (along === 'z') g.rotateY(Math.PI / 2);
    return along === 'z' ? g.translate(at, 0, (a0 + a1) / 2) : g.translate((a0 + a1) / 2, 0, at);
  };
  const out = { tufa: [place(body)], brick: [], trav: [] };
  // The arches' brick rings on both faces: voussoirs round each head.
  if (lod < 2) {
    for (const o of openings) {
      const cy = -0.5 + o.y + o.h;
      const nv = lod ? 7 : 11;
      for (const face of [0, -thick]) {
        for (let k = 0; k < nv; k++) {
          const a = Math.PI - ((k + 0.5) / nv) * Math.PI;
          // (Its depth along the radius, its width along the ring.)
          const g = new BoxGeometry(0.16, (Math.PI * (r + 0.08)) / nv - 0.012, 0.05);
          g.rotateZ(a);
          g.translate(o.x + Math.cos(a) * (r + 0.08), cy + Math.sin(a) * (r + 0.08), face + (face ? -0.02 : 0.02));
          boxUV(g);
          out.brick.push(place(tintGeometry(g, () => 0.85 + ((k * 37) % 7) * 0.03)));
        }
      }
    }
  }
  // The edge stones along the quay's top (travertine), a little proud on both faces.
  if (kerb) {
    const rnd = artRng(seed);
    let p = -L / 2;
    while (p < L / 2 - 0.05) {
      const q = Math.min(L / 2, p + 0.7 + rnd() * 0.5);
      const g = slab(q - p - 0.008, 0.14, thick + 0.08, { bevel: 0.015, seed: seed + p * 13, wobble: lod ? 0 : 0.003, tone: 0.06, grime: 0.1 });
      g.translate((p + q) / 2, top - 0.14, -thick / 2);
      out.trav.push(place(g));
      p = q;
    }
  }
  return out;
}

/**
 * A block of ashlar filling the box x0..x1, y0..y1, z0..z1: courses of cut
 * stones (`course` high, of seeded lengths along the longer of x and z),
 * each course's joints off the one below. Far out (lod 2) one stone.
 */
export function ashlar(x0, x1, y0, y1, z0, z1, { seed = 1, lod = 0, course = 0.42, min = 0.7, max = 1.25, grime = 0.25, bevel = 0.016 } = {}) {
  const rnd = artRng(seed);
  const out = [];
  const alongX = x1 - x0 >= z1 - z0;
  const L0 = alongX ? x0 : z0;
  const L1 = alongX ? x1 : z1;
  const D0 = alongX ? z0 : x0;
  const D1 = alongX ? z1 : x1;
  if (lod === 2) {
    const g = slab(x1 - x0, y1 - y0, z1 - z0, { bevel: 0.01, seed, wobble: 0, tone: 0, grime });
    return [g.translate((x0 + x1) / 2, y0, (z0 + z1) / 2)];
  }
  const n = Math.max(1, Math.round((y1 - y0) / course));
  const h = (y1 - y0) / n;
  for (let c = 0; c < n; c++) {
    let p = L0;
    let first = true;
    while (p < L1 - 0.02) {
      let q = Math.min(L1, p + min + rnd() * (max - min) - (first && c % 2 ? (max - min) / 2 + 0.2 : 0));
      if (L1 - q < min * 0.45) q = L1;
      first = false;
      const len = q - p - 0.008;
      const g = alongX
        ? slab(len, h - 0.008, D1 - D0, { bevel, seed: seed + c * 31 + p * 7, wobble: lod ? 0 : 0.003, tone: 0.07, grime: c ? grime * 0.3 : grime })
        : slab(D1 - D0, h - 0.008, len, { bevel, seed: seed + c * 31 + p * 7, wobble: lod ? 0 : 0.003, tone: 0.07, grime: c ? grime * 0.3 : grime });
      out.push(alongX ? g.translate((p + q) / 2, y0 + c * h, (D0 + D1) / 2) : g.translate((D0 + D1) / 2, y0 + c * h, (p + q) / 2));
      p = q;
    }
  }
  return out;
}

/** A stone mooring bollard (a short turned post) standing on (x, y, z). */
export function bollard(x, y, z, lod = 0) {
  const seg = lod === 0 ? 14 : lod === 1 ? 8 : 5;
  return revolve(profileOf([[0.15, 0], [0.15, 0.06], [0.11, 0.12], [0.1, 0.3], [0.13, 0.36], [0.14, 0.42], [0.1, 0.46], [0, 0.47]]), {
    segments: seg,
    metres: 0.8,
    tint: (p) => 0.7 + 0.3 * smoothstep(0, 0.3, p.y),
  }).translate(x, y, z);
}

/** An iron mooring ring hanging on a staple from a quay's face (facing `s` along z, or along x with `alongX`). */
export function mooringRing(x, y, z, s = 1, lod = 0, alongX = false) {
  const g = new TorusGeometry(0.09, 0.016, lod ? 4 : 6, lod ? 10 : 18);
  g.translate(0, -0.09, 0.022);
  if (s < 0) g.rotateY(Math.PI);
  if (alongX) g.rotateY(Math.PI / 2);
  boxUV(g);
  return tintGeometry(g, () => 0.8).translate(x, y, z);
}

/**
 * Steps down a quay's face to the water: `n` treads from `top` down to the
 * water, running down along +z (turn and move them into place), `w` wide.
 */
export function waterSteps(w, top, n = 4, depth = 0.32, seed = 1, lod = 0) {
  const out = [];
  const rise = top / n;
  for (let k = 0; k < n; k++) {
    const h = top - k * rise;
    out.push(slab(w, h + 0.3, depth + 0.02, { bevel: 0.012, seed: seed + k, wobble: lod ? 0 : 0.003, tone: 0.05, grime: 0.4 }).translate(0, -0.3, k * depth + depth / 2));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Oars, racks, coils of rope
// ---------------------------------------------------------------------------

/** An oar `len` long lying along +z from the origin (loom, shaft, blade). Returns wood geometries. */
export function oar(len = 3.4, lod = 0) {
  const seg = lod ? 4 : 6;
  const loom = new CylinderGeometry(0.03, 0.034, len * 0.3, seg);
  loom.rotateX(Math.PI / 2).translate(0, 0, len * 0.15);
  const shaft = new CylinderGeometry(0.024, 0.03, len * 0.52, seg);
  shaft.rotateX(Math.PI / 2).translate(0, 0, len * 0.56);
  const blade = new BoxGeometry(0.14, 0.018, len * 0.2);
  blade.translate(0, 0, len * 0.9);
  const out = [loom, shaft, blade].map((g) => tintGeometry(boxUV(g)));
  return out;
}

/** A rope coil lying on y (flat rings of a hawser), radius r. */
export function ropeCoil(x, y, z, r = 0.3, turns = 4, lod = 0) {
  const out = [];
  for (let k = 0; k < (lod === 2 ? 1 : turns); k++) {
    const g = new TorusGeometry(r - k * 0.035, 0.028, lod ? 4 : 6, lod ? 12 : 22);
    g.rotateX(Math.PI / 2);
    g.translate(x, y + 0.028 + (k % 2) * 0.03, z);
    boxUV(g);
    out.push(tintGeometry(g, () => 0.85 - k * 0.05));
  }
  return out;
}

// ---------------------------------------------------------------------------
// The liburnian
// ---------------------------------------------------------------------------

/**
 * The liburnian's measures (metres): fitted to the game, whose ships are
 * drawn a little smaller than life beside its people, a 12 m slip and a
 * 12 m harbour: length with the ram, beam, depth of the hull amidships.
 */
export const LIBURNIAN = Object.freeze({ L: 8.2, B: 1.5, D: 0.8 });

/** Where the hull's surface is: t 0 (stern) to 1 (bow), girth f 0 (keel) to 1 (sheer); returns [x, y, z] (starboard, +x). */
export function hullPoint(t, f) {
  const { L, B, D: Dp } = LIBURNIAN;
  const u = 2 * t - 1;
  // Half-breadth at the sheer: full amidships, fine at the bow (the ram leads), fuller at the stern.
  const hb = (B / 2) * (u > 0 ? (1 - u ** 2.6) ** 0.62 : (1 - (-u) ** 2.1) ** 0.55);
  // The keel's line: straight, rising into the stern's run; the sheer: rising at both ends, most at the stern.
  const yk = t < 0.16 ? 0.5 * ((0.16 - t) / 0.16) ** 1.7 : 0;
  const ys = Dp + 0.42 * (1 - t) ** 3.2 + 0.26 * t ** 4;
  // The section: round bilged amidships, sharp (a V) toward the ends.
  const sharp = Math.max(smoothstep(0.32, 0.02, t), smoothstep(0.62, 1.0, t));
  const a = (f * Math.PI) / 2;
  const xr = Math.sin(a) ** 0.85;
  const yr = 1 - Math.cos(a);
  const x = hb * (xr + (f - xr) * sharp);
  const y = yk + (ys - yk) * (yr + (f ** 1.15 - yr) * sharp);
  return [x, y, (t - 0.5) * (L - 0.7)];
}

/** The inward normal of the section at (t, f), in the x-y plane (starboard side). */
function inward(t, f) {
  const e = 0.01;
  const a = hullPoint(t, Math.max(0, f - e));
  const b = hullPoint(t, Math.min(1, f + e));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  return [-dy / l, dx / l];
}

/** A grid of points (rows along the hull, columns across) as a surface: UVs u across in metres, v along. */
function gridSurface(rows, tintAt, flip = false) {
  const R = rows.length;
  const C = rows[0].length;
  const pos = [];
  const uv = [];
  const col = [];
  const idx = [];
  for (let i = 0; i < R; i++) {
    let u = 0;
    for (let j = 0; j < C; j++) {
      const p = rows[i][j];
      if (j) u += Math.hypot(p[0] - rows[i][j - 1][0], p[1] - rows[i][j - 1][1]);
      pos.push(p[0], p[1], p[2]);
      uv.push(u, p[2]);
      const k = tintAt(i, j, p);
      if (typeof k === 'number') col.push(k, k, k);
      else col.push(k[0], k[1], k[2]);
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
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Mirror a starboard geometry to port (x to -x, the winding turned so it still faces out). */
function mirrored(g) {
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

/** The pitch below and the paint above: the strake's vertex colour. */
const PITCH = lin(0x3b3633);
const PLANK = 1;

/**
 * A liburnian on the slip or afloat, at a step of its building (the sim's
 * progress, models/fleet.js hullStep):
 *   1  the keel laid on its blocks, stem and sternpost raised and braced,
 *      the garboards and the next strakes fastened to it
 *   2  the shell up to the turn of the bilge, the first frames fitted
 *      inside it (Graeco-Roman hulls were built shell first)
 *   3  the shell to the sheer, frames, beams and benches in
 *   4  finished: the wales, the oar box (outrigger) with its two rows of
 *      ports, the rail, the bronze ram and the boar's head over it, the
 *      eye, the steering oars, pitched below and painted above
 * In the hull's own frame: the keel's bottom amidships at the origin, the
 * bow toward +z, starboard +x. Returns lists of geometries by material
 * key (harbourMaterials): wood (bare timber), pitch-dark planks are wood
 * tinted, paint, gilt, bronze, rope, white, black, dark.
 */
export function liburnianHull(step, { lod = 0, seed = 5 } = {}) {
  const out = { wood: [], paint: [], gilt: [], bronze: [], iron: [], rope: [], white: [], black: [] };
  if (step <= 0) return out;
  const rnd = artRng(seed);
  const { L } = LIBURNIAN;
  const NT = lod === 0 ? 30 : lod === 1 ? 14 : 7;
  const strakes = lod === 0 ? 11 : lod === 1 ? 6 : 3;
  // How high the shell has risen (strakes laid), by the step.
  const laid = step === 1 ? Math.ceil(strakes * 0.27) : step === 2 ? Math.ceil(strakes * 0.6) : strakes;
  const finished = step >= 4;
  const T0 = 0.015;
  const T1 = 0.985;
  const ts = [];
  for (let i = 0; i <= NT; i++) ts.push(T0 + ((T1 - T0) * i) / NT);
  // The strakes, starboard then mirrored: each its own tone, a dark seam at its edges (a row of
  // vertices just inside each edge), pitched below the waterline once finished.
  const waterF = 0.42;
  for (let s = 0; s < laid; s++) {
    const f0 = s / strakes;
    const f1 = (s + 1) / strakes;
    const tone = 0.82 + rnd() * 0.24;
    const fs = lod === 0 ? [f0, f0 + 0.08 / strakes, f1 - 0.08 / strakes, f1] : [f0, f1];
    const rows = ts.map((t) => fs.map((f) => hullPoint(t, f)));
    const g = gridSurface(rows, (i, j, p) => {
      const seam = lod === 0 && (j === 0 || j === fs.length - 1) ? 0.62 : 1;
      if (finished && fs[j] < waterF + 0.02) return [PITCH[0] * seam, PITCH[1] * seam, PITCH[2] * seam];
      return tone * seam * PLANK;
    }, true);
    const key = finished && f0 >= 0.72 ? 'paint' : 'wood';
    out[key].push(g, mirrored(g));
    // The inside of the strake (a plank's thickness in), darker: seen from above over the rail.
    if (lod < 2) {
      const inner = ts.map((t) => fs.map((f) => {
        const p = hullPoint(t, f);
        const [nx, ny] = inward(t, f);
        return [p[0] + nx * 0.04, p[1] + ny * 0.04, p[2]];
      }));
      const gi = gridSurface(inner, () => 0.5 * tone);
      out.wood.push(gi, mirrored(gi));
    }
  }
  // The top edge of the highest strake laid: a narrow face from the outside to the inside.
  if (lod < 2 && laid > 0) {
    const f = laid / strakes;
    const rows = ts.map((t) => {
      const p = hullPoint(t, f);
      const [nx, ny] = inward(t, f);
      return [p, [p[0] + nx * 0.04, p[1] + ny * 0.04, p[2]]];
    });
    const g = gridSurface(rows, () => 0.75, true);
    out.wood.push(g, mirrored(g));
  }
  // The keel: a squared timber under the hull's middle line, from the sternpost's foot to the forefoot.
  const keel = [];
  for (let i = 0; i <= 16; i++) {
    const t = 0.02 + (0.96 * i) / 16;
    const p = hullPoint(t, 0);
    keel.push([0, p[1] - 0.08, p[2]]);
  }
  out.wood.push(sweep(keel, 0.13, 0.17, { side: [1, 0, 0] }));
  // The stem: from the forefoot up and a little forward to over the sheer.
  const bow = hullPoint(T1, 1);
  const zb = bow[2];
  const stem = [[0, 0.02, zb - 0.1], [0, 0.35, zb + 0.06], [0, 0.75, zb + 0.13], [0, bow[1] + 0.12, zb + 0.16], [0, bow[1] + 0.32, zb + 0.12]];
  out.wood.push(sweep(stem, 0.13, 0.15, { side: [1, 0, 0] }));
  // The sternpost: up from the run of the stern, curling up and forward over it (a goose's neck at full detail).
  const st = hullPoint(T0, 1);
  const zs = st[2];
  const stern = [[0, 0.32, zs + 0.25], [0, 0.6, zs - 0.02], [0, st[1], zs - 0.14], [0, st[1] + 0.5, zs - 0.26], [0, st[1] + 0.95, zs - 0.18], [0, st[1] + 1.2, zs + 0.02], [0, st[1] + 1.18, zs + 0.2]];
  if (lod === 0) stern.push([0, st[1] + 1.06, zs + 0.3]);
  out[finished ? 'gilt' : 'wood'].push(sweep(stern, 0.12, 0.15, { side: [1, 0, 0], taper: 0.55 }));
  // Frames: shaped timbers inside the shell, every 0.42 m, as high as the shell has risen (one step behind it).
  if (step >= 2 && lod < 2) {
    const top = step === 2 ? (laid - 1) / strakes : 1;
    const every = lod ? 0.84 : 0.42;
    for (let z = -L / 2 + 0.9; z < L / 2 - 0.8; z += every) {
      const t = z / (L - 0.7) + 0.5;
      const pts = [];
      const n = lod ? 5 : 9;
      for (let k = 0; k <= n; k++) {
        const f = 0.04 + ((top - 0.04) * k) / n;
        const p = hullPoint(t, f);
        const [nx, ny] = inward(t, f);
        pts.push([p[0] + nx * 0.09, p[1] + ny * 0.09, p[2]]);
      }
      const g = sweep(pts, 0.07, 0.08, { side: [0, 0, 1] });
      out.wood.push(g, mirrored(g));
      // The floor timber across the keel, joining the two sides' frames.
      out.wood.push(board(0.5 * (1 + (1 - Math.abs(2 * t - 1))), 0.09, 0.07, { tone: 0.8 }).translate(0, pts[0][1] - 0.02, z));
    }
  }
  // The beams and the rowers' benches across the hull, and the keelson over the frames.
  if (step >= 3 && lod < 2) {
    for (let z = -L / 2 + 1.5; z < L / 2 - 1.2; z += 0.84) {
      const t = z / (L - 0.7) + 0.5;
      const p = hullPoint(t, 0.82);
      out.wood.push(board(p[0] * 2 - 0.08, 0.06, 0.18, { tone: 0.95 }).translate(0, p[1] - 0.06, z));
    }
    const kl = [];
    for (let i = 0; i <= 8; i++) {
      const t = 0.12 + (0.76 * i) / 8;
      const p = hullPoint(t, 0.05);
      kl.push([0, p[1] + 0.12, p[2]]);
    }
    out.wood.push(sweep(kl, 0.12, 0.12, { side: [1, 0, 0] }));
  }
  if (finished) finishHull(out, lod, ts);
  return out;
}

/** Step 4's fittings: wales, the oar box with its ports, the rail, the decks at the ends, the ram, the eye, the steering oars. */
function finishHull(out, lod, ts) {
  const { L } = LIBURNIAN;
  const run = (f, off, t0 = 0.05, t1 = 0.96, n = 14) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n;
      const p = hullPoint(t, f);
      const [nx, ny] = inward(t, f);
      pts.push([p[0] - nx * off, p[1] - ny * off, p[2]]);
    }
    return pts;
  };
  // Two wales along each side: thick strakes standing proud, the upper one gilded at its edge.
  for (const [f, key] of [[0.55, 'wood'], [0.8, 'paint']]) {
    const g = sweep(run(f, 0.035), 0.09, 0.06, { side: [0, 1, 0] });
    out[key].push(g, mirrored(g));
  }
  // The oar box (parexeiresia): a box along each side at the sheer, standing out over the wales,
  // the upper oars through its ports, the lower bank's ports in the hull under it.
  const t0 = 0.26;
  const t1 = 0.8;
  const box = [];
  for (let i = 0; i <= 8; i++) {
    const t = t0 + ((t1 - t0) * i) / 8;
    const p = hullPoint(t, 0.94);
    box.push([p[0] + 0.12, p[1] + 0.02, p[2]]);
  }
  const ob = sweep(box, 0.22, 0.17, { side: [1, 0, 0] });
  out.paint.push(ob, mirrored(ob));
  // Its top rail, gilded, and the gunwale's cap along the whole sheer.
  const rail = run(1, -0.01, 0.04, 0.97, 16).map((p) => [p[0], p[1] + 0.03, p[2]]);
  const rg = sweep(rail, 0.08, 0.06, { side: [1, 0, 0] });
  out.gilt.push(rg, mirrored(rg));
  if (lod < 2) {
    const n = lod ? 5 : 9;
    for (let k = 0; k < n; k++) {
      const t = t0 + 0.04 + ((t1 - t0 - 0.08) * (k + 0.5)) / n;
      const p = hullPoint(t, 0.94);
      // The upper port in the oar box's face, the lower one in the hull, half a step aft.
      for (const s of [1, -1]) {
        const up = new BoxGeometry(0.02, 0.06, 0.09).translate(s * (p[0] + 0.225), p[1] + 0.02, p[2]);
        out.black.push(tintGeometry(boxUV(up)));
        const q = hullPoint(t - 0.035, 0.66);
        const lo = new CylinderGeometry(0.04, 0.04, 0.02, 8).rotateZ(Math.PI / 2).translate(s * (q[0] + 0.012), q[1], q[2]);
        out.black.push(tintGeometry(boxUV(lo)));
      }
    }
  }
  // Decks over the bow and the stern (the fighting decks), and a gangway between them.
  if (lod < 2) {
    for (const [ta, tb] of [[0.06, 0.2], [0.84, 0.95]]) {
      const pa = hullPoint(ta, 0.97);
      const pb = hullPoint(tb, 0.97);
      const w = Math.min(hullPoint(ta, 1)[0], hullPoint(tb, 1)[0]) * 2 + 0.1;
      out.wood.push(board(w, 0.05, Math.abs(pb[2] - pa[2]), { tone: 0.95 }).translate(0, Math.max(pa[1], pb[1]) - 0.04, (pa[2] + pb[2]) / 2));
    }
    const gw = hullPoint(0.5, 0.9);
    out.wood.push(board(0.5, 0.05, L * 0.62, { tone: 0.9 }).translate(0, gw[1] + 0.02, 0.1));
  }
  // The ram (rostrum), cast bronze over the forefoot, after the Athlit ram: a sheath tapering
  // forward to a head of three horizontal fins; over it, at the wale's end, the boar's head.
  const fore = hullPoint(0.985, 0);
  const z0 = fore[2] - 0.32;
  const head = fore[2] + 0.52;
  const ram = new BufferGeometry();
  const sec = (z, w, h, y) => [[-w, y - h, z], [w, y - h, z], [w, y + h, z], [-w, y + h, z]];
  const A = sec(z0, 0.17, 0.22, 0.24);
  const Bq = sec(head - 0.1, 0.11, 0.12, 0.3);
  const quads = [];
  for (let k = 0; k < 4; k++) quads.push([A[k], A[(k + 1) % 4], Bq[(k + 1) % 4], Bq[k]]);
  quads.push([Bq[0], Bq[1], Bq[2], Bq[3]]);
  const pos = [];
  for (const q of quads) pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
  ram.setAttribute('position', new Float32BufferAttribute(pos, 3));
  ram.computeVertexNormals();
  out.gilt.push(tintGeometry(boxUV(ram), () => 0.9));
  for (const y of [0.2, 0.3, 0.4]) {
    out.gilt.push(tintGeometry(boxUV(new BoxGeometry(0.34, 0.03, 0.16).translate(0, y, head - 0.04)), () => 1));
  }
  out.gilt.push(tintGeometry(boxUV(new BoxGeometry(0.03, 0.28, 0.2).translate(0, 0.3, head - 0.02)), () => 1));
  if (lod < 2) {
    const wale = hullPoint(0.97, 0.8);
    const boar = revolve(profileOf([[0, 0], [0.07, 0], [0.09, 0.1], [0.07, 0.2], [0.03, 0.26], [0, 0.27]]), { segments: lod ? 6 : 10, metres: 0.3 });
    boar.rotateX(Math.PI / 2).translate(0, wale[1], wale[2] + 0.08);
    out.bronze.push(boar);
  }
  // The eye on the bow, each side (against ill luck, and to see the way), at full detail.
  if (lod === 0) {
    const p = hullPoint(0.9, 0.72);
    const [nx, ny] = inward(0.9, 0.72);
    for (const s of [1, -1]) {
      const e = new SphereGeometry(0.1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.18);
      e.scale(1.5, 1, 0.75);
      e.rotateZ(-s * Math.PI / 2);
      e.translate(s * (p[0] - nx * 0.06), p[1] - ny * 0.06, p[2]);
      out.white.push(tintGeometry(boxUV(e)));
      const pu = new SphereGeometry(0.045, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.2);
      pu.rotateZ(-s * Math.PI / 2);
      pu.translate(s * (p[0] - nx * 0.075), p[1] - ny * 0.075, p[2] + 0.02);
      out.black.push(tintGeometry(boxUV(pu)));
    }
  }
  // The steering oars on the quarters, raised (as a ship on the slip or moored keeps them), and their bar.
  const q = hullPoint(0.12, 1);
  for (const s of [1, -1]) {
    const loom = [[s * (q[0] + 0.08), q[1] + 0.35, q[2] + 0.3], [s * (q[0] + 0.22), q[1] - 0.1, q[2] - 0.15], [s * (q[0] + 0.28), q[1] - 0.45, q[2] - 0.5]];
    out.wood.push(sweep(loom, 0.07, 0.07, { side: [1, 0, 0] }));
    out.wood.push(board(0.05, 0.42, 0.55).rotateX(-0.75).translate(s * (q[0] + 0.3), q[1] - 0.82, q[2] - 0.62));
  }
  out.wood.push(board(q[0] * 2 + 0.5, 0.08, 0.1).translate(0, q[1] + 0.02, q[2] + 0.15));
}

// ---------------------------------------------------------------------------
// A rower, seated, pulling an oar
// ---------------------------------------------------------------------------

/** A capsule from a to b (arrays), radius r. */
function limb(a, b, r, seg = 8) {
  const A = new Vector3(...a);
  const B = new Vector3(...b);
  const len = A.distanceTo(B);
  const g = new CapsuleGeometry(r, Math.max(0.001, len), 3, seg);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  const m = A.clone().add(B).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return tintGeometry(boxUV(g));
}

/**
 * A rower on a bench whose seat is at y = 0.45 over his feet's floor (y =
 * 0), facing +z (toward the stern, as rowers sit), his hands on the oar's
 * loom at (hx, hy, hz) (`pull` 0 the catch, leaning forward; 1 the finish,
 * leaning back). Returns { cloth, skin, hair } geometries for the figure's
 * materials (figure.js keys: cloth-<hex>, skin-<hex>, hair-<hex>).
 */
export function rower(pull = 0.5, seed = 1, lod = 0) {
  const rnd = artRng(seed);
  const seg = lod ? 5 : 8;
  const lean = -0.35 + pull * 0.7; // radians: forward (to -z... toward the oar) at the catch, back at the finish
  const seat = [0, 0.45, 0];
  const sh = [0, 0.45 + 0.52 * Math.cos(lean), -0.52 * Math.sin(lean) * -1];
  const out = { cloth: [], skin: [], hair: [] };
  // The tunic: a tapered body from the seat to the shoulders.
  const body = new CylinderGeometry(0.16, 0.19, 0.56, seg + 4, 1);
  body.translate(0, 0.28, 0);
  body.scale(1, 1, 0.7);
  body.rotateX(lean);
  body.translate(seat[0], seat[1], seat[2]);
  out.cloth.push(tintGeometry(boxUV(body), () => 0.9));
  // Thighs along +z... the feet braced forward of him (toward -z, the oar's side is the stern's way).
  for (const s of [-1, 1]) {
    const hip = [s * 0.09, 0.47, 0.02];
    const knee = [s * 0.11, 0.6, -0.36];
    const foot = [s * 0.12, 0.06, -0.52];
    out.cloth.push(limb(hip, knee, 0.075, seg));
    out.skin.push(limb(knee, foot, 0.05, seg));
  }
  // Arms out to the loom in front of him (toward -z).
  const hand = [0, sh[1] - 0.18 - pull * 0.05, -0.55 + pull * 0.35];
  for (const s of [-1, 1]) {
    const shoulder = [s * 0.19, sh[1] - 0.03, sh[2]];
    const elbow = [s * 0.22, (shoulder[1] + hand[1]) / 2 - 0.06, (shoulder[2] + hand[2]) / 2 + 0.06 * (1 - pull)];
    out.cloth.push(limb(shoulder, [shoulder[0] * 1.05, shoulder[1] - 0.08, shoulder[2]], 0.06, seg));
    out.skin.push(limb(shoulder, elbow, 0.042, seg), limb(elbow, [s * 0.14, hand[1], hand[2]], 0.036, seg));
  }
  // The head on its neck.
  const head = new SphereGeometry(0.1, seg + 4, seg);
  head.scale(0.92, 1.12, 1.02);
  head.translate(sh[0], sh[1] + 0.17, sh[2] - 0.02);
  out.skin.push(tintGeometry(boxUV(head)));
  const cap = new SphereGeometry(0.105, seg + 4, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
  cap.scale(0.94, 1.1, 1.05);
  cap.rotateX(-0.3);
  cap.translate(sh[0], sh[1] + 0.185, sh[2] - 0.025);
  out.hair.push(tintGeometry(boxUV(cap), () => 0.8 + rnd() * 0.2));
  return { ...out, hand };
}

/** The materials a rower takes (figure.js's keys, so they are the town's people's). */
export function rowerMaterials(cloth = 0x9a6a44, skin = 0xa87a58, hair = 0x2e2119) {
  return {
    cloth: material(`cloth-${cloth.toString(16)}`, { surface: 'wool', color: cloth, vertexColors: true, snow: 0.15 }),
    skin: material(`skin-${skin.toString(16)}`, { color: skin, roughness: 0.55, snow: 0, wet: 0 }),
    hair: material(`hair-${hair.toString(16)}`, { color: hair, roughness: 0.7, snow: 0.2 }),
  };
}

export { merge, D };
