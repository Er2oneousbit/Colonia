/**
 * models/healing.js
 * ----------------------------------------------------------------------------
 * What the barber, the physician, the baths and the hospital of the 3D look
 * share (tonstrina.js, medicus.js, balneum.js, valetudinarium.js): their
 * materials, a patient lying abed under a blanket, the furniture of Roman
 * care (a stool, a couch or bed with its mattress and pillow, a table, a
 * basin on its stand, pots of remedies, a mortar and pestle, towels), the
 * staff of Asclepius with its serpent, beds of herbs, and the baths' steam
 * and smoke.
 *
 * People are learning.js person(): standing or seated, posed by their
 * wrists. A patient abed is that person laid on his back.
 *
 * Steam and smoke are soft ribbons (crossed sheets of a grid whose vertices
 * carry an alpha that fades to nothing at their edges and top), see-through,
 * writing no depth, lit by the sun; their own copy of the water's ripples
 * as a normal map, scrolled upward by the look's clock (uLookTime) as each
 * is drawn (the material's onBeforeRender), so they seem to rise and curl
 * without a vertex moving, and without a hook in the game's model pass.
 *
 * Metres, y up, facing +z, as the other models (models/well.js); every
 * geometry has position, normal, uv (metres) and an RGB colour, so merge()
 * takes them (the steam's colours are RGBA: a part of its own).
 * ----------------------------------------------------------------------------
 */

import {
  BufferGeometry, Float32BufferAttribute, CylinderGeometry, SphereGeometry, BoxGeometry, Vector3,
} from 'three';
import { revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { material, surfaceTextures, LOOK } from '../materials.js';
import { artRng } from '../texgen.js';
import { slab } from './masonry.js';
import { lin } from './rural.js';
import { learningMaterials, person, bush, box } from './learning.js';

/** The materials the four share besides the schools' (learning.js learningMaterials). */
export function healthMaterials() {
  return {
    ...learningMaterials(),
    // The baths' brick facing (the warehouse's), their vaults' waterproof render (crushed tile in lime).
    brick: material('brick', { surface: 'brick', vertexColors: true, snow: 1 }),
    signinum: material('cocciopesto', { surface: 'cocciopesto', vertexColors: true, snow: 0.9 }),
    // Towels, sheets, a barber's cloth, a patient's blanket: undyed linen and wool, their tones in the vertices.
    linen: material('sail-linen', { surface: 'wool', color: 0xe9e1cc, vertexColors: true, snow: 0.9 }),
    // A mirror of polished bronze (speculum), the barber's and the physician's fine bronze things.
    gilt: material('gilt', { surface: 'bronze', color: 0xffcf6a, rough: 0.6, vertexColors: true, snow: 0.5 }),
    // A furnace's coals (the naval station's beacon's), and a cold one's ash.
    embers: material('beacon-ember', { color: 0x5a2a10, roughness: 0.9, emissive: 0xff7a2a, emissiveIntensity: 1.6, snow: 0, wet: 0 }),
    ash: material('cold-ash', { color: 0x4a4440, roughness: 0.95, snow: 1 }),
    // Potted earth (the market's), and the dust and leaves of an empty pool.
    soil: material('pot-soil', { color: 0x2c2118, roughness: 1, snow: 0.8 }),
    stain: material('wet-stain', { color: 0x1a1612, roughness: 0.2, opacity: 0.5, snow: 0, wet: 0 }),
  };
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/**
 * A patient lying on his back (learning.js person, laid down), his head on
 * the pillow end, a blanket over him to the chest: at (x, y, z) the middle
 * of his length on the mattress's top at y, along ry (his head toward -z
 * when ry is 0). Returns [{ g, material }] for castra.js people().
 */
export function abed(mats, opts, x, y, z, ry, { blanket = 0x8a6a4a, scale = 1 } = {}) {
  const parts = person(mats, { arms: 'down', ...opts }, 0, 0, 0, 0, scale);
  // (Standing on y 0 facing +z: a quarter turn about x lays him with his head toward -z, face up; his
  // back, 0.1 behind his middle, then rests on the mattress.)
  for (const p of parts) {
    p.g.rotateX(-Math.PI / 2);
    p.g.translate(0, y + 0.1 * scale, 0.82 * scale);
    p.g.rotateY(ry);
    p.g.translate(x, 0, z);
  }
  // The blanket: from his feet to his chest, a little wider than he is, its top rounded over him.
  // (Laid down, his feet are at z 0.82 of his frame and his chest at -0.4, its top 0.24 over the mattress.)
  const len = 1.25 * scale;
  const b = new BoxGeometry(0.64 * scale, 0.2 * scale, len, 4, 1, 3);
  const p = b.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / (0.32 * scale);
    // (A hump over the body: the top's middle up, its edges down to the mattress.)
    const top = p.getY(i) > 0;
    p.setY(i, top ? 0.28 * scale * (1 - 0.6 * u * u) : -0.02);
    p.setX(i, p.getX(i) * (top ? 0.9 : 1));
  }
  b.computeVertexNormals();
  b.translate(0, y + 0.02, 0.86 * scale - len / 2);
  b.rotateY(ry);
  b.translate(x, 0, z);
  const rgb = lin(blanket);
  parts.push({ g: tintGeometry(boxUV(b), (px, py) => [rgb[0] * (0.85 + 0.6 * (py - y)), rgb[1] * (0.85 + 0.6 * (py - y)), rgb[2] * (0.85 + 0.6 * (py - y))]), material: mats.cloth });
  return parts;
}

/**
 * A sleeper glimpsed through a ward's door: only what shows over the
 * blanket (a head on the pillow, the hair, the shoulders, a hand on the
 * cover), a sixth of a whole person's triangles; placed as abed().
 * Returns [{ g, material }].
 */
export function sleeper(mats, { skin = 0xa87a58, hair = 0x2e2119, blanket = 0x8a6a4a } = {}, x, y, z, ry) {
  const parts = [];
  const sk = lin(skin);
  const head = new SphereGeometry(0.1, 10, 7);
  head.scale(0.92, 1.02, 1.12);
  head.translate(0, y + 0.13, -0.74);
  parts.push({ g: tintGeometry(boxUV(head), () => sk), material: mats.skin });
  const cap = new SphereGeometry(0.106, 10, 4, 0, Math.PI * 2, 0, Math.PI * 0.55);
  cap.rotateX(-Math.PI / 2 - 0.3);
  cap.translate(0, y + 0.12, -0.76);
  parts.push({ g: tintGeometry(boxUV(cap), () => lin(hair)), material: mats.hair });
  for (const s of [-1, 1]) {
    const hand = new SphereGeometry(0.045, 6, 4);
    hand.scale(0.8, 0.6, 1.2);
    hand.translate(s * 0.16, y + 0.26, -0.18 + s * 0.08);
    parts.push({ g: tintGeometry(boxUV(hand), () => sk), material: mats.skin });
  }
  const b = lin(blanket);
  const cover = slab(0.6, 0.24, 1.32, { bevel: 0.08, seed: Math.round(x * 7 + z * 13), wobble: 0.01, tone: 0.05, grime: 0 });
  cover.translate(0, y - 0.01, 0.12);
  parts.push({ g: tintGeometry(cover, (px, py) => [b[0] * (0.8 + 0.8 * (py - y)), b[1] * (0.8 + 0.8 * (py - y)), b[2] * (0.8 + 0.8 * (py - y))]), material: mats.cloth });
  for (const q of parts) {
    q.g.rotateY(ry);
    q.g.translate(x, 0, z);
  }
  return parts;
}

/** A point of a frame at (x, z) turned ry, (dx right, dz ahead) in it: the model's [x, z]. */
export function inFrame(x, z, ry, dx, dz) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return [x + dx * c + dz * s, z - dx * s + dz * c];
}

// ---------------------------------------------------------------------------
// Furniture and things
// ---------------------------------------------------------------------------

/** A stool (sella): a round wooden seat on three splayed legs, `h` high, at (x, z). Returns wood geometries. */
export function stool(x, z, h = 0.45, lod = 0) {
  const seg = lod ? 8 : 14;
  const out = [tintGeometry(boxUV(new CylinderGeometry(0.2, 0.19, 0.05, seg, 1).translate(x, h - 0.025, z)), () => 0.85)];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    const g = new CylinderGeometry(0.022, 0.026, h - 0.04, 5, 1);
    g.rotateZ(0.12);
    g.rotateY(-a);
    g.translate(x + Math.cos(a) * 0.12, (h - 0.04) / 2, z + Math.sin(a) * 0.12);
    out.push(tintGeometry(boxUV(g), () => 0.7));
  }
  return out;
}

/**
 * A couch or bed (lectus) along z, `w` wide and `l` long, its frame `h`
 * high, at (x, z) turned ry: a turned wooden frame on four legs, a mattress
 * of wool, a pillow at the head end (-z). Returns { wood, cloth } (the
 * mattress and pillow in the vertices' colour `tick`).
 */
export function lectus(x, z, ry, { w = 0.8, l = 1.9, h = 0.42, lod = 0, tick = 0xd8ccb0, pillow = true, back = false } = {}) {
  const wood = [];
  const cloth = [];
  // The frame's rails, and its legs, turned close up.
  wood.push(box(w, 0.08, l, 0, h - 0.08, 0, 0.72));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = lod ? box(0.06, h - 0.08, 0.06, 0, 0, 0, 0.6) : tintGeometry(revolve(profileOf([[0, 0], [0.035, 0], [0.03, 0.1], [0.042, 0.16], [0.026, 0.24], [0.03, h - 0.12], [0.04, h - 0.09], [0, h - 0.08]]), { segments: 8, metres: 0.3 }), () => 0.62);
      leg.translate(sx * (w / 2 - 0.05), 0, sz * (l / 2 - 0.05));
      wood.push(leg);
    }
  }
  // A head board (fulcrum) at the pillow end of a couch for reclining.
  if (back) wood.push(box(w, 0.32, 0.06, 0, h, -l / 2 + 0.03, 0.7));
  const t = lin(tick);
  const mat = slab(w - 0.04, 0.12, l - 0.04, { bevel: 0.04, seed: Math.round(x * 13 + z * 7), wobble: lod ? 0 : 0.008, tone: 0.04, grime: 0 });
  mat.translate(0, h, 0);
  cloth.push(tintGeometry(mat, () => t));
  if (pillow) {
    const p = slab(w - 0.2, 0.1, 0.3, { bevel: 0.045, seed: Math.round(x * 5 + z * 3) + 2, wobble: lod ? 0 : 0.01, tone: 0, grime: 0 });
    p.translate(0, h + 0.11, -l / 2 + 0.24);
    cloth.push(tintGeometry(p, () => [t[0] * 1.08, t[1] * 1.08, t[2] * 1.08]));
  }
  for (const g of [...wood, ...cloth]) {
    g.rotateY(ry);
    g.translate(x, 0, z);
  }
  return { wood, cloth };
}

/** A table: a wooden top `w` x `d` at height `h` on four legs, at (x, z). Returns wood geometries. */
export function table(x, z, w, d, h = 0.78, ry = 0) {
  const out = [box(w, 0.045, d, 0, h - 0.045, 0, 0.82)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(box(0.05, h - 0.045, 0.05, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06), 0.62));
  for (const g of out) {
    g.rotateY(ry);
    g.translate(x, 0, z);
  }
  return out;
}

/**
 * A pot of remedy or ointment: `kind` 'jar' (an ointment jar, a pyxis),
 * 'flask' (an unguentarium, narrow-necked), 'amph' (a little amphora), its
 * foot at (x, y, z), `s` tall. Returns a geometry in terracotta, toned.
 */
export function pot(kind, x, y, z, s = 0.14, lod = 0, tone = 1) {
  // (A big pot by the door needs its roundness close up; a shelf's dozen small ones do not.)
  const seg = lod ? 6 : s > 0.25 ? 14 : 8;
  const P = kind === 'flask'
    ? [[0, 0], [0.18, 0], [0.34, 0.12], [0.36, 0.3], [0.22, 0.48], [0.1, 0.62], [0.09, 0.9], [0.14, 0.96], [0.14, 1], [0, 1]]
    : kind === 'amph'
      ? [[0, 0], [0.06, 0], [0.3, 0.3], [0.38, 0.55], [0.3, 0.76], [0.14, 0.84], [0.12, 0.96], [0.16, 1], [0, 1]]
      : [[0, 0], [0.32, 0], [0.42, 0.1], [0.44, 0.5], [0.4, 0.72], [0.44, 0.78], [0.44, 0.84], [0.28, 0.9], [0.1, 0.96], [0.12, 1], [0, 1]];
  const g = revolve(P.map(([r, h]) => [r * s, h * s]), { segments: seg, metres: 0.2, tint: (p) => tone * (0.75 + 0.25 * Math.min(1, (p.y / s) * 1.5)) });
  return g.translate(x, y, z);
}

/** A row of pots along x on a shelf top at y, from x0 to x1 at z: mixed kinds and tones. Returns geometries. */
export function potRow(x0, x1, y, z, { seed = 1, lod = 0, s = 0.14 } = {}) {
  const rnd = artRng(seed);
  const out = [];
  let x = x0 + 0.06;
  while (x < x1 - 0.06) {
    const kind = ['jar', 'flask', 'amph', 'jar'][Math.floor(rnd() * 4)];
    const k = s * (0.7 + rnd() * 0.5);
    out.push(pot(kind, x, y, z + (rnd() - 0.5) * 0.06, k, lod, 0.75 + rnd() * 0.35));
    x += k * 0.8 + 0.03 + rnd() * 0.04;
  }
  return out;
}

/**
 * A basin of bronze on a turned stand (a barber's, a physician's, a labrum's
 * small cousin), its rim at height h, radius r, at (x, z). Returns { stand,
 * bowl, water } (the water a disc just under the rim, or null).
 */
export function basinStand(x, z, { h = 0.82, r = 0.22, lod = 0, water = true } = {}) {
  const seg = lod === 2 ? 8 : lod ? 12 : 20;
  const stand = revolve(profileOf([[0, 0], [0.16, 0], [0.16, 0.04], [0.06, 0.08], [0.045, 0.3], [0.05, h - 0.28], [0.08, h - 0.16], [0.03, h - 0.12], [0, h - 0.12]]), { segments: seg, metres: 0.4, tint: (p) => 0.7 + 0.3 * Math.min(1, p.y / h) });
  const bowl = revolve(profileOf([[0, h - 0.13], [r * 0.4, h - 0.13], [r * 0.85, h - 0.07], [r, h - 0.01], [r + 0.01, h], [r - 0.012, h], [r * 0.82, h - 0.075], [r * 0.38, h - 0.115], [0, h - 0.115]]), { segments: seg, metres: 0.4 });
  const out = { stand: [tintGeometry(stand.translate(x, 0, z))], bowl: [tintGeometry(bowl.translate(x, 0, z), () => 0.95)], water: null };
  if (water) {
    const g = new CylinderGeometry(r * 0.88, r * 0.88, 0.004, seg, 1);
    g.translate(x, h - 0.03, z);
    out.water = tintGeometry(boxUV(g));
  }
  return out;
}

/** A mortar of stone with its pestle, on (x, y, z). Returns stone geometries. */
export function mortar(x, y, z, lod = 0) {
  const seg = lod ? 8 : 14;
  const m = revolve(profileOf([[0, 0], [0.09, 0], [0.11, 0.03], [0.12, 0.1], [0.13, 0.12], [0.1, 0.12], [0.08, 0.06], [0, 0.05]]), { segments: seg, metres: 0.3, tint: (p) => 0.8 + 0.2 * (p.y / 0.12) });
  m.translate(x, y, z);
  const p = new CylinderGeometry(0.022, 0.03, 0.2, 6, 1);
  p.rotateZ(0.5);
  p.translate(x + 0.04, y + 0.14, z);
  return [m, tintGeometry(boxUV(p), () => 0.9)];
}

/** A towel hung over a rail or a rim: a sheet of linen folded over at y, `w` wide, hanging `drop` down each side, d apart, at (x, z) along x. */
export function towel(x, y, z, { w = 0.4, drop = 0.35, d = 0.05, ry = 0, tone = 1 } = {}) {
  const g = new BoxGeometry(w, drop, 0.012);
  const out = [];
  for (const s of [-1, 1]) {
    const h = drop * (s < 0 ? 1 : 0.8);
    const sh = g.clone().scale(1, h / drop, 1);
    sh.translate(0, y - h / 2, s * d / 2);
    out.push(sh);
  }
  out.push(new BoxGeometry(w, 0.02, d + 0.012).translate(0, y + 0.005, 0));
  for (const o of out) {
    o.rotateY(ry);
    o.translate(x, 0, z);
  }
  return out.map((o) => tintGeometry(boxUV(o), (px, py) => tone * (0.85 + 0.15 * Math.min(1, Math.max(0, (py - y + drop) / drop)))));
}

/**
 * The staff of Asclepius: a knotted staff with a serpent coiled up it, its
 * head over the top, the physician's sign since Greek times (Asclepius's
 * cult came to Rome in 291 BC, to the Tiber island). Its foot at (x, y, z),
 * `h` tall. Returns { wood, snake }.
 */
export function asclepius(x, y, z, h, { lod = 0, ry = 0 } = {}) {
  const wood = [];
  const snake = [];
  const st = new CylinderGeometry(0.022, 0.03, h, lod ? 6 : 10, lod ? 1 : 4);
  // (A knotted branch: its middle pushed about a little.)
  if (!lod) {
    const p = st.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 1 + 0.25 * Math.sin(p.getY(i) * 31);
      p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
    }
    st.computeVertexNormals();
  }
  st.translate(0, h / 2, 0);
  wood.push(tintGeometry(boxUV(st), () => 0.75));
  // The serpent: a helix round the staff, three turns, thinning to its tail at the foot, its head over the top.
  const pts = [];
  const turns = 3;
  const n = lod ? 14 : 36;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const a = t * turns * Math.PI * 2;
    const r = 0.05 + 0.01 * Math.sin(t * 9);
    pts.push(new Vector3(Math.cos(a) * r, 0.12 * h + t * 0.78 * h, Math.sin(a) * r));
  }
  const last = pts[pts.length - 1];
  pts.push(new Vector3(last.x * 0.4, 0.94 * h, last.z * 0.4 + 0.03), new Vector3(0, h + 0.02, 0.07));
  const body = tube(pts, 0.017, { radial: lod ? 4 : 7, segments: lod ? 18 : 60, around: 0.05 });
  // (Thinner toward its tail: the tube's rings scaled by how far along it they are.)
  const bp = body.attributes.position;
  const bu = body.attributes.uv;
  const total = body.userData.length;
  for (let i = 0; i < bp.count; i++) {
    const t = bu.getX(i) / total;
    const sc = 0.35 + 0.65 * Math.min(1, t * 2.5);
    const c = new Vector3(bp.getX(i), bp.getY(i), bp.getZ(i));
    // (Pulled toward the curve's axis by the ring's shrink: near enough the staff's axis.)
    c.x = c.x * (0.6 + 0.4 * sc);
    c.z = c.z * (0.6 + 0.4 * sc);
    bp.setXYZ(i, c.x, c.y, c.z);
  }
  body.computeVertexNormals();
  snake.push(tintGeometry(body, (px, py) => 0.75 + 0.25 * Math.sin(py * 40)));
  const head = new SphereGeometry(0.03, lod ? 6 : 10, lod ? 4 : 7);
  head.scale(0.8, 0.6, 1.4);
  head.translate(0, h + 0.03, 0.09);
  snake.push(tintGeometry(boxUV(head)));
  for (const g of [...wood, ...snake]) {
    g.rotateY(ry);
    g.translate(x, y, z);
  }
  return { wood, snake };
}

/**
 * A bed of herbs (a raised bed edged in boards, rows of plants of a few
 * kinds and greens: the medicinal herbs of the military hospitals' gardens,
 * fenugreek, henbane, centaury, plantain, fennel, with some in flower), over
 * x0..x1, z0..z1. Returns { wood, soil, leaf, bloom }.
 */
export function herbBed(x0, x1, z0, z1, { lod = 0, seed = 1, rows = 3, bloom = 0xb08ad0 } = {}) {
  const rnd = artRng(seed);
  const out = { wood: [], soil: [], leaf: [], bloom: [] };
  const h = 0.18;
  const w = x1 - x0;
  const d = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  for (const s of [-1, 1]) {
    out.wood.push(box(w, h, 0.05, cx, 0, cz + s * (d / 2 - 0.025), 0.7));
    out.wood.push(box(0.05, h, d - 0.1, cx + s * (w / 2 - 0.025), 0, cz, 0.7));
  }
  out.soil.push(box(w - 0.1, h - 0.03, d - 0.1, cx, 0, cz, 0.9));
  if (lod === 2) {
    out.leaf.push(tintGeometry(box(w - 0.16, 0.12, d - 0.16, cx, h - 0.03, cz), () => [0.05, 0.1, 0.035]));
    return out;
  }
  // Rows across the bed's long side, a kind a row.
  const along = w >= d;
  const L = along ? w : d;
  const S = along ? d : w;
  const greens = [[0.05, 0.11, 0.035], [0.07, 0.12, 0.04], [0.04, 0.085, 0.04], [0.085, 0.12, 0.05]];
  const b = lin(bloom);
  for (let r = 0; r < rows; r++) {
    const off = -S / 2 + 0.12 + ((r + 0.5) * (S - 0.24)) / rows;
    const g = greens[(r + seed) % greens.length];
    const n = Math.max(2, Math.round((L - 0.2) / (lod ? 0.42 : 0.32)));
    for (let k = 0; k < n; k++) {
      const a = -L / 2 + 0.14 + ((k + 0.5) * (L - 0.28)) / n + (rnd() - 0.5) * 0.04;
      const px = along ? cx + a : cx + off;
      const pz = along ? cz + off : cz + a;
      const r0 = 0.09 + rnd() * 0.05;
      // (Eighty faces a plant: a bed holds a score of them, and their lumps read at any zoom.)
      const ball = bush(px, h + r0 * 0.6, pz, r0, { lod: 2, seed: seed * 17 + r * 7 + k, squash: 0.8 });
      for (const q of ball) {
        const c = q.attributes.color;
        for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) / 0.045 * g[0] * 1.5, c.getY(i) / 0.11 * g[1] * 1.5, c.getZ(i) / 0.032 * g[2] * 1.5);
      }
      out.leaf.push(...ball);
      // Flowers on some rows (lavender, chamomile, poppy): a few dots over the crown, close up.
      if (lod === 0 && r === 1) {
        for (let j = 0; j < 3; j++) {
          const f = new SphereGeometry(0.025, 5, 3);
          f.translate(px + (rnd() - 0.5) * r0, h + r0 * 1.35 + rnd() * 0.04, pz + (rnd() - 0.5) * r0);
          out.bloom.push(tintGeometry(boxUV(f), () => b));
        }
      }
    }
  }
  return out;
}

/**
 * A small window on a wall's outer face (the face at z 0 facing +z, before
 * the turn): its dark on the face, a travertine sill, one wooden shutter
 * swung back against the wall; `w` x `h`, its sill at y, its middle at x,
 * turned `ry` about y and moved to (cx, cz). Returns { dark, stone, wood }.
 */
export function wallWindow(cx, cz, ry, { x = 0, y = 2.2, w = 0.4, h = 0.42, lod = 0, seed = 1 } = {}) {
  const out = { dark: [box(w, h, 0.006, x, y, 0.004)], stone: [], wood: [] };
  if (lod < 2) {
    // (Proud of the wall by 4 cm at most: a barber's back wall stands 5 cm inside its footprint.)
    out.stone.push(slab(w + 0.14, 0.05, 0.07, { bevel: 0.008, seed, wobble: 0, tone: 0.03, grime: 0 }).translate(x, y - 0.05, 0.0));
    out.wood.push(box(w * 0.55, h - 0.02, 0.03, x + w / 2 + w * 0.3, y + 0.01, 0.025, 0.65));
    if (lod === 0) out.wood.push(box(w + 0.04, 0.04, 0.04, x, y + h, 0.02, 0.55));
  }
  for (const g of [...out.dark, ...out.stone, ...out.wood]) {
    g.rotateY(ry);
    g.translate(cx, 0, cz);
  }
  return out;
}

/**
 * A bed of coals: lumps of charcoal heaped in a disc of radius r at (x, y, z),
 * some of them glowing. Returns { hot, dark }: the glowing lumps (the
 * embers' material, shown while the fire is in), the rest (charcoal, always).
 * A cold fire shows its `hot` lumps in ash.
 */
export function coals(x, y, z, r, { seed = 1, lod = 0, n = 0 } = {}) {
  const rnd = artRng(seed);
  const out = { hot: [], dark: [] };
  const count = n || (lod ? 10 : 26);
  for (let k = 0; k < count; k++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * r;
    const s = 0.025 + rnd() * 0.025;
    const g = new SphereGeometry(s, lod ? 5 : 6, lod ? 3 : 4);
    g.scale(1.2, 0.7, 1);
    g.rotateY(rnd() * 3);
    g.translate(x + Math.cos(a) * d, y + s * 0.5 + (1 - d / r) * r * 0.25, z + Math.sin(a) * d);
    const t = 0.6 + rnd() * 0.4;
    (k % 5 < 2 ? out.hot : out.dark).push(tintGeometry(boxUV(g), () => t));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Steam and smoke
// ---------------------------------------------------------------------------

/**
 * The see-through material of the baths' steam and the furnace's smoke:
 * white, its vertices' alpha shaping each wisp, a normal map of its own
 * (the ripples) scrolled up and drifting with the look's clock as it is
 * drawn, so the plume seems to boil upward.
 */
export function steamMaterial() {
  // (Kept by the look's cache, which a shut-down back end empties: set up again on the next ask.)
  const m = material('bath-steam', { color: 0xf4f2ee, roughness: 0.95, opacity: 0.9, snow: 0, wet: 0 });
  if (m.userData.steam) return m;
  m.userData.steam = true;
  // (The plain normal map swapped for a real one: one program either way, the texture differs.)
  const nm = surfaceTextures('ripples', 'steam').normalMap;
  m.normalMap = nm;
  m.normalScale.set(1.6, 1.6);
  m.onBeforeRender = () => {
    const t = LOOK.uniforms.uLookTime.value;
    nm.offset.set(Math.sin(t * 0.13) * 0.4, -t * 0.22);
  };
  return m;
}

/**
 * A plume of steam or smoke rising from (x, y, z): `n` crossed ribbons, each
 * a grid of `cols` x `rows`, widening from r at its root to about three
 * times that at its top `h` up, leaning with the wind (dx, dz over its
 * height), its alpha a soft lens across and fading out upward. Each ribbon
 * has both faces (the material is one-sided: one program fewer). `rgb`
 * the colour times the material's white. Returns one geometry, RGBA.
 */
export function plume(x, y, z, { h = 1.4, r = 0.12, n = 2, cols = 5, rows = 7, lean = [0.35, 0.15], seed = 1, rgb = [1, 1, 1], alpha = 0.8 } = {}) {
  const rnd = artRng(seed);
  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];
  const idx = [];
  const ph = rnd() * 6.28;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI + rnd() * 0.3;
    const ax = Math.cos(a);
    const az = Math.sin(a);
    for (const face of [1, -1]) {
      const base = pos.length / 3;
      for (let j = 0; j <= rows; j++) {
        const v = j / rows;
        const wid = r * (1 + 2.2 * v);
        // The centre line: leaning with the wind, curling a little.
        const cx = x + lean[0] * v * v + Math.sin(v * 5 + ph) * 0.06 * v;
        const cz = z + lean[1] * v * v + Math.cos(v * 4 + ph) * 0.05 * v;
        const cy = y + h * v;
        for (let i = 0; i <= cols; i++) {
          const u = i / cols;
          const s = (u - 0.5) * 2 * wid;
          pos.push(cx + ax * s, cy + Math.sin(u * 3.1 + v * 4 + ph) * 0.04, cz + az * s);
          // (Facing up, a little out: lit as soft stuff, not as a card turning edge-on.)
          const nx = -az * face * 0.35;
          const nz = ax * face * 0.35;
          const l = Math.hypot(nx, 1, nz);
          nor.push(nx / l, 1 / l, nz / l);
          uv.push(s * 0.8 + k * 0.37, (cy - y) * 0.6 + k * 0.21);
          const across = Math.sin(Math.PI * u) ** 1.6;
          const up = Math.min(1, v / 0.12) * (1 - v) ** 1.3;
          col.push(rgb[0], rgb[1], rgb[2], alpha * across * up);
        }
      }
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const q = base + j * (cols + 1) + i;
          const qn = q + cols + 1;
          if (face > 0) idx.push(q, q + 1, qn, q + 1, qn + 1, qn);
          else idx.push(q, qn, q + 1, q + 1, qn, qn + 1);
        }
      }
    }
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 4));
  return g;
}

