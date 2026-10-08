/**
 * models/trainingParts.js
 * ----------------------------------------------------------------------------
 * What the training buildings of the shows share (grex.js, ludusGladiatorius.js,
 * vivarium.js, factio.js): their materials, the low wall and gate to the
 * street, iron bars, a stone trough, a hay heap, the gladiators' arms as a
 * rack holds them (the murmillo's brimmed helmet, the thraex's crested one,
 * small shields, a net, a trident, greaves), an actor's mask on a peg, a
 * costume hung to air, a chest, a wig on its stand, the palm and the wreath
 * of a victory, a cart.
 *
 * Every helper pushes geometries into `out` lists by material key (`bag()`
 * makes one); `assemble()` turns a bag into the model's parts (TaggedParts),
 * one draw call a material and state. Metres, y up, facing +z, as the other
 * models (models/well.js); every geometry has position, normal, uv (metres)
 * and an RGB colour, so merge() takes them.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry, BoxGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { material, waterMaterial, iceMaterial } from '../materials.js';
import { TaggedParts, slab, lantern, lanternPane } from './masonry.js';
import { lin } from './rural.js';
import { box, cyl, staff } from './castra.js';
import { healthMaterials } from './healing.js';

export { box, cyl, staff, lin };

/** The materials the four share besides the health buildings' (healing.js, which has the forts' and the schools'). */
export function trainingMaterials() {
  return {
    ...healthMaterials(),
    // Walls in white stucco (the governor's houses'): the street's plaster is a poor house's, painted red to 1.3 m.
    stucco: material('gov-stucco', { surface: 'stucco', color: 0xffffff, vertexColors: true, snow: 1 }),
    // The arena's sand (the campus's riding ring's): fine, pale, raked.
    sand: material('ring-sand', { surface: 'earth', color: 0xe8d4a8, vertexColors: true, snow: 1 }),
    // Cloth airing on a rail, a cart's tilt, a costume: the dyed wool, its colour in the vertices.
    cloth: material('cloth-dyed', { surface: 'wool', vertexColors: true, snow: 0.7 }),
    // Masks, wig stands, painted boards: plain colours in the vertices.
    paint: material('paint', { color: 0xffffff, roughness: 0.6, vertexColors: true, snow: 0.8 }),
    // A trough's water (the look's), and its ice in a hard frost.
    water: waterMaterial(),
    ice: iceMaterial(),
  };
}

/** The lists a training building is built into, by material key (and its tagged things by state). */
export function bag(extra = []) {
  const keys = ['gravel', 'sand', 'flags', 'ashlar', 'stone', 'trav', 'tile', 'wood', 'plaster', 'red', 'ochre', 'dark', 'iron', 'bronze',
    'gilt', 'letters', 'rope', 'straw', 'hay', 'paint', 'cloth', 'linen', 'leather', 'leaf', 'water', 'shelteredWood', 'shelteredFloor', ...extra];
  return Object.fromEntries(keys.map((k) => [k, []]));
}

/**
 * A model's parts from a bag: one part a material (the small things cast no
 * shadow: each part casting is one more draw in the sun's pass), the
 * tagged lists added by the caller. `ice` freezes the trough's water.
 */
export function assemble(name, out, lod, { ice = false } = {}) {
  const m = trainingMaterials();
  if (lod === 2) {
    // (Far out the fittings are under a pixel, each a draw call for every building in view.)
    out.iron = out.bronze = out.letters = out.rope = out.gilt = [];
    out.wood.push(...out.shelteredWood.splice(0));
  }
  const p = new TaggedParts(name);
  const small = { cast: false };
  p.add('yard', m.gravel, out.gravel, small);
  p.add('sand', m.sand, out.sand, small);
  p.add('flags', m.flags, out.flags, small);
  p.add('ashlar', m.ashlar, out.ashlar);
  p.add('stone', m.stone, out.stone);
  p.add('trav', m.trav, out.trav);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, out.wood);
  p.add('sheltered-wood', m.shelteredWood, out.shelteredWood);
  p.add('sheltered-floor', m.shelteredFloor, out.shelteredFloor, small);
  p.add('walls', m.stucco, out.plaster);
  p.add('dado', m.red, out.red, small);
  p.add('panels', material('stucco-ochre', { surface: 'plaster', color: 0xd8b070, vertexColors: true, snow: 1 }), out.ochre, small);
  p.add('inside', m.dark, out.dark, small);
  p.add('iron', m.iron, out.iron, small);
  p.add('bronze', m.bronze, out.bronze, small);
  p.add('gilt', m.gilt, out.gilt, small);
  p.add('letters', m.letters, out.letters, small);
  p.add('rope', m.rope, out.rope, small);
  p.add('straw', m.straw, out.straw);
  p.add('hay', m.hay, out.hay);
  p.add('paint', m.paint, out.paint, small);
  p.add('cloth', m.cloth, out.cloth, { cast: lod === 0 });
  p.add('linen', m.linen, out.linen, small);
  p.add('leather', m.leather, out.leather, small);
  p.add('leaf', m.leaf, out.leaf, small);
  p.add(ice ? 'trough-ice' : 'trough-water', ice ? m.ice : m.water, out.water, small);
  return { p, m };
}

/** A part's lanterns (models/masonry.js), lit while staffed, cold while shut; hung from a bracket at (x, y, z). */
export function lamps(p, m, list, lod) {
  if (lod === 2) return;
  for (const [lx, ly, lz] of list) {
    const l = lantern(lx, ly, lz, lod);
    p.add('lantern', m.bronze, l.bronze, { cast: false });
    p.add('lamp', lanternPane(), [l.pane], { when: 'staffed', cast: false });
    p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
  }
}

// ---------------------------------------------------------------------------
// Walls, bars, troughs
// ---------------------------------------------------------------------------

/**
 * A low wall with a coping round the front and sides of a footprint of
 * half size `e` (the back closed by the building), a gate (x g0..g1) in the
 * front with its piers and two leaves (open while staffed, across it when
 * shut); `sides` [z0, z1] for the side walls' run (from the back range to
 * the front). Pushes into out (plaster, tile, ashlar, stone, doorOpen,
 * doorShut).
 */
export function enclosure(out, { e, g0, g1, sides = null, h = 0.85, t = 0.24, seed = 1 }) {
  // (`sides` one run for both, or { l, r } a run each: a side closed by the building for part of its length.)
  const [l0, l1] = (sides && sides.l) || sides || [-e + 1, e];
  const [r0, r1] = (sides && sides.r) || sides || [-e + 1, e];
  const runs = [['x', -e, g0, e - t / 2], ['x', g1, e, e - t / 2], ['z', l0, l1, -e + t / 2], ['z', r0, r1, e - t / 2]];
  for (const [ax, a, b, at] of runs) {
    if (b - a < 0.05) continue;
    out.plaster.push(ax === 'x' ? box(b - a, h, t, (a + b) / 2, 0, at, 0.85) : box(t, h, b - a, at, 0, (a + b) / 2, 0.85));
    out.tile.push(ax === 'x' ? box(b - a, 0.06, t + 0.08, (a + b) / 2, h, at, 0.9) : box(t + 0.08, 0.06, b - a, at, h, (a + b) / 2, 0.9));
  }
  for (const x of [g0 - 0.2, g1 + 0.2]) {
    out.ashlar.push(box(0.4, 1.45, 0.4, x, 0, e - 0.2, 0.9));
    out.stone.push(slab(0.5, 0.1, 0.5, { bevel: 0.015, seed: seed + x * 7, wobble: 0, tone: 0, grime: 0 }).translate(x, 1.45, e - 0.2));
  }
  const gw = g1 - g0;
  for (const s of [-1, 1]) {
    const hx = s < 0 ? g0 : g1;
    out.doorShut.push(box(gw / 2 - 0.02, 1.05, 0.05, hx - s * (gw / 4), 0.03, e - 0.22, 0.72));
    out.doorOpen.push(box(0.05, 1.05, gw / 2 - 0.02, hx - s * 0.03, 0.03, e - 0.22 - gw / 4, 0.72));
  }
}

/** Iron bars from y0 to y1 along x (x0..x1) at z, every `step`: the cages' fronts. */
export function barsAlongX(out, x0, x1, y0, y1, z, step = 0.13, r = 0.014, lod = 0) {
  const n = Math.max(1, Math.round((x1 - x0) / (lod === 2 ? step * 2 : step)));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    out.iron.push(staff([x, y0, z], [x, y1, z], r, lod === 0 ? 6 : 4));
  }
  // The flat cross bars binding them.
  for (const y of lod === 0 ? [y0 + (y1 - y0) * 0.33, y0 + (y1 - y0) * 0.68] : [(y0 + y1) / 2]) out.iron.push(box(x1 - x0, 0.03, 0.022, (x0 + x1) / 2, y, z, 0.8));
}

/** The same along z at x. */
export function barsAlongZ(out, z0, z1, y0, y1, x, step = 0.13, r = 0.014, lod = 0) {
  const n = Math.max(1, Math.round((z1 - z0) / (lod === 2 ? step * 2 : step)));
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    out.iron.push(staff([x, y0, z], [x, y1, z], r, lod === 0 ? 6 : 4));
  }
  for (const y of lod === 0 ? [y0 + (y1 - y0) * 0.33, y0 + (y1 - y0) * 0.68] : [(y0 + y1) / 2]) out.iron.push(box(0.022, 0.03, z1 - z0, x, y, (z0 + z1) / 2, 0.8));
}

/** A stone trough (x, z its middle, `len` along x unless `alongZ`), its water a little under its rim. */
export function trough(out, x, z, len, { w = 0.55, h = 0.5, alongZ = false, seed = 1 } = {}) {
  const [lx, lz] = alongZ ? [w, len] : [len, w];
  const t = 0.08;
  out.stone.push(slab(lx, 0.1, lz, { bevel: 0.01, seed, wobble: 0.003, tone: 0.04, grime: 0.3 }).translate(x, 0, z));
  for (const s of [-1, 1]) {
    out.stone.push(slab(alongZ ? t : lx, h, alongZ ? lz : t, { bevel: 0.012, seed: seed + s, wobble: 0.002, tone: 0.04, grime: 0.35 }).translate(alongZ ? x + s * (lx - t) / 2 : x, 0, alongZ ? z : z + s * (lz - t) / 2));
    out.stone.push(slab(alongZ ? lx - 2 * t : t, h, alongZ ? t : lz - 2 * t, { bevel: 0.012, seed: seed + 3 + s, wobble: 0.002, tone: 0.04, grime: 0.35 }).translate(alongZ ? x : x + s * (lx - t) / 2, 0, alongZ ? z + s * (lz - t) / 2 : z));
  }
  const water = new BoxGeometry(lx - 2 * t, 0.01, lz - 2 * t);
  water.translate(x, h - 0.08, z);
  out.water.push(tintGeometry(boxUV(water)));
}

/** A lumpy heap of hay (x, z), radius r, height h. */
export function hayHeap(out, x, z, r, h, { lod = 0, seed = 1 } = {}) {
  const g = new SphereGeometry(r, lod === 0 ? 14 : lod === 1 ? 9 : 6, lod === 0 ? 8 : 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i);
    const py = p.getY(i);
    const pz = p.getZ(i);
    const k = lod === 2 ? 1 : 1 + 0.12 * Math.sin(px * 9 + seed) * Math.sin(pz * 8 + seed * 2) + 0.06 * Math.sin(py * 23 + px * 17);
    p.setXYZ(i, px * k, (py / r) * h * k, pz * k);
  }
  g.computeVertexNormals();
  g.translate(x, 0, z);
  out.hay.push(tintGeometry(boxUV(g), (gx, gy) => 0.85 + 0.15 * Math.min(1, gy / h)));
}

/** A wooden chest (cista) w x d x h at (x, z) turned ry, its lid shut or stood open behind it; its wood stained `colour`. */
export function chest(out, x, z, w, d, h, { ry = 0, open = false, colour = 0x6a4a2a, lod = 0 } = {}) {
  const geos = [box(w, h, d, 0, 0, 0, 0.82)];
  if (lod < 2) {
    // Its iron-bound corners as darker battens, the lid.
    for (const sd of [-1, 1]) geos.push(box(0.03, h + 0.01, d + 0.01, sd * (w / 2 - 0.08), 0, 0, 0.55));
    geos.push(open ? box(w, d, 0.03, 0, h, -d / 2 - 0.015, 0.75) : box(w + 0.02, 0.05, d + 0.02, 0, h, 0, 0.75));
  }
  const c = lin(colour);
  for (const g of geos) {
    const col = g.attributes.color;
    for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * c[0] * 2.2, col.getY(i) * c[1] * 2.2, col.getZ(i) * c[2] * 2.2);
    out.wood.push(g.rotateY(ry).translate(x, 0, z));
  }
}

// ---------------------------------------------------------------------------
// The gladiators' arms (on racks: their people wear units/gear.js's)
// ---------------------------------------------------------------------------

/**
 * A gladiator's helmet on a peg at (x, y, z), its face toward `ry`: the
 * murmillo's (`kind` 'murmillo': a broad brim all round, the face behind a
 * grille of pierced bronze, a tall crest along its top like a fish's fin,
 * after the helmets from the barracks at Pompeii), or the thraex's
 * ('thraex': the same brim and grille, a curved crest with a griffin's
 * head at its front). Pushes bronze, iron and paint (the crest's plume).
 */
export function gladiatorHelmet(out, x, y, z, ry, kind, lod, plume = 0x9a2a20) {
  const seg = lod === 0 ? 14 : 8;
  const parts = { bronze: [], iron: [], paint: [] };
  const bowl = new SphereGeometry(0.135, seg, lod === 0 ? 8 : 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
  bowl.scale(1, 1.05, 1.12);
  bowl.translate(0, 0.07, 0);
  parts.bronze.push(tintGeometry(boxUV(bowl), () => 0.95));
  // The brim: a broad flat ring, dipping at the front.
  const brim = new CylinderGeometry(0.24, 0.25, 0.012, seg + 4, 1, true);
  brim.translate(0, 0.07, 0.01);
  parts.bronze.push(tintGeometry(boxUV(brim), () => 0.9));
  const brimTop = new CylinderGeometry(0.24, 0.24, 0.006, seg + 4, 1);
  brimTop.translate(0, 0.076, 0.01);
  parts.bronze.push(tintGeometry(boxUV(brimTop), () => 0.88));
  // The visor: a half drum under the brim at the front, its grille dark between bronze rims.
  const visor = new CylinderGeometry(0.13, 0.12, 0.2, seg, 1, true, -Math.PI * 0.5, Math.PI);
  visor.translate(0, -0.03, 0.02);
  parts.bronze.push(tintGeometry(boxUV(visor), () => 0.85));
  if (lod === 0) {
    for (const [gx, gy] of [[-0.04, 0.0], [0.04, 0.0], [-0.04, -0.06], [0.04, -0.06]]) parts.iron.push(box(0.05, 0.04, 0.012, gx, gy - 0.02, 0.135, 0.25));
  }
  if (kind === 'murmillo') {
    // The fin: a tall flat crest front to back, the plume's feathers along its top.
    parts.bronze.push(box(0.025, 0.12, 0.28, 0, 0.15, -0.01, 0.9));
    parts.paint.push(tintGeometry(box(0.04, 0.05, 0.3, 0, 0.27, -0.01), () => lin(plume)));
  } else {
    // The thraex's crest curving up and forward to a griffin's head.
    for (let k = 0; k < (lod === 0 ? 5 : 3); k++) {
      const a = (k / 4) * 1.2;
      parts.bronze.push(box(0.03, 0.05, 0.07, 0, 0.18 + Math.sin(a) * 0.08, -0.12 + k * 0.06, 0.92));
    }
    parts.bronze.push(box(0.05, 0.06, 0.08, 0, 0.28, 0.13, 1));
    if (lod === 0) parts.paint.push(tintGeometry(box(0.012, 0.16, 0.012, 0.07, 0.24, -0.06), () => lin(plume)), tintGeometry(box(0.012, 0.16, 0.012, -0.07, 0.24, -0.06), () => lin(plume)));
  }
  for (const [k, list] of Object.entries(parts)) for (const g of list) out[k].push(g.rotateY(ry).translate(x, y, z));
}

/** A small shield on a peg: the thraex's parmula (a little square, curved) or a round one, its face toward ry. */
export function parmula(out, x, y, z, ry, lod, colour = 0x8a2a20) {
  const g = new CylinderGeometry(0.4, 0.4, 0.5, lod === 0 ? 8 : 4, 1, true, -0.32, 0.64);
  g.translate(0, 0, -0.4);
  boxUV(g);
  const c = lin(colour);
  const gold = lin(0xd8a84a);
  out.paint.push(tintGeometry(g, (px, py) => (Math.abs(py) > 0.22 || Math.abs(px) > 0.11 ? gold : c)).rotateY(ry).translate(x, y, z));
  if (lod < 2) {
    const boss = new SphereGeometry(0.04, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    boss.rotateX(Math.PI / 2);
    out.bronze.push(tintGeometry(boxUV(boss)).rotateY(ry).translate(x + Math.sin(ry) * 0.01, y, z + Math.cos(ry) * 0.01));
  }
}

/** A retiarius's net hung from a peg at (x, y, z): a drape of cord in a grid, gathered at the peg, its weights at the hem. */
export function hungNet(out, x, y, z, ry, lod) {
  const rows = lod === 0 ? 7 : 3;
  const cols = lod === 0 ? 6 : 3;
  const pts = (i, j) => {
    const v = i / rows;
    const u = j / cols - 0.5;
    const w = 0.1 + 0.4 * v;
    return [u * w * 2, -v * 1.1, 0.03 * Math.sin(u * 9 + v * 5) + 0.05 * v];
  };
  const r = 0.004;
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j < cols; j++) out.rope.push(staff(pts(i, j), pts(i, j + 1), r, 3).rotateY(ry).translate(x, y, z));
  }
  for (let j = 0; j <= cols; j++) {
    for (let i = 0; i < rows; i++) out.rope.push(staff(pts(i, j), pts(i + 1, j), r, 3).rotateY(ry).translate(x, y, z));
    if (lod === 0) out.iron.push(tintGeometry(new SphereGeometry(0.018, 5, 3).translate(...pts(rows, j)), () => 0.6).rotateY(ry).translate(x, y, z));
  }
}

/** A trident (fuscina) leaning from its butt at (x, 0, z) up to (tx, ty, tz). */
export function trident(out, x, z, tx, ty, tz, lod) {
  out.wood.push(staff([x, 0, z], [tx, ty, tz], 0.014, lod === 0 ? 6 : 4));
  const dx = tx - x;
  const dy = ty;
  const dz = tz - z;
  const L = Math.hypot(dx, dy, dz);
  const ux = dx / L;
  const uy = dy / L;
  const uz = dz / L;
  // The three prongs, their crossbar square to the shaft in the vertical plane through it.
  const sx = -uz;
  const sz = ux;
  const sl = Math.hypot(sx, sz) || 1;
  for (const k of [-1, 0, 1]) {
    const bx = tx + (sx / sl) * k * 0.05;
    const bz = tz + (sz / sl) * k * 0.05;
    out.iron.push(staff([bx, ty, bz], [bx + ux * 0.22, ty + uy * 0.22, bz + uz * 0.22], 0.007, 4));
  }
  out.iron.push(staff([tx - (sx / sl) * 0.06, ty, tz - (sz / sl) * 0.06], [tx + (sx / sl) * 0.06, ty, tz + (sz / sl) * 0.06], 0.009, 4));
}

/** A pair of greaves hung by their straps at (x, y, z) on a wall facing ry. */
export function greaves(out, x, y, z, ry, lod) {
  for (const s of [-1, 1]) {
    const g = new CylinderGeometry(0.06, 0.05, 0.38, lod === 0 ? 10 : 6, 1, true, -Math.PI * 0.6, Math.PI * 1.2);
    g.translate(s * 0.075, -0.2, 0.04);
    out.bronze.push(tintGeometry(boxUV(g), () => 0.9).rotateY(ry).translate(x, y, z));
  }
}

/** A wooden post for the drill (palus): 1.8 m, its face hacked. */
export function palus(out, x, z, lod) {
  out.wood.push(box(0.22, 1.8, 0.22, x, 0, z, (gx, gy) => 0.6 + 0.3 * Math.min(1, gy / 1.2)));
  if (lod === 0) for (let k = 0; k < 6; k++) out.dark.push(box(0.12, 0.012, 0.005, x - 0.02 + (k % 2) * 0.04, 0.75 + k * 0.15, z + 0.112));
}

// ---------------------------------------------------------------------------
// The theatre's things
// ---------------------------------------------------------------------------

/**
 * An actor's mask hung on a peg at (x, y, z) on a wall facing ry: the tragic
 * mask's pale face, gaping mouth and tall hair, or the comic's ruddy face and
 * grin; their paint in the vertices.
 */
export function hungMask(out, x, y, z, ry, kind, lod, hair = 0x2a1e16) {
  const rows = lod === 0 ? 7 : 3;
  const cols = lod === 0 ? 8 : 4;
  // (Three's sphere has +z at phi pi/2: phi 0 to pi is the half facing out from the wall.)
  const face = new SphereGeometry(0.11, cols, rows, 0, Math.PI, Math.PI * 0.08, Math.PI * 0.84);
  face.scale(0.85, 1.25, 0.55);
  face.translate(0, 0, 0.02);
  const tragic = kind === 'tragic';
  const skin = lin(tragic ? 0xe6dccb : 0xc07850);
  const dark = lin(0x1a120c);
  out.paint.push(tintGeometry(boxUV(face), (px, py) => {
    // The eyes' holes and the mouth (a gape for the tragic, a wide grin for the comic), painted dark.
    const eye = Math.abs(Math.abs(px) - 0.035) < 0.017 && Math.abs(py - 0.035) < 0.012;
    const mouth = tragic ? Math.hypot(px / 0.03, (py + 0.065) / 0.028) < 1 : Math.abs(px) < 0.05 && Math.abs(py + 0.06 + 0.25 * px * px * 20) < 0.016;
    return eye || mouth ? dark : skin;
  }).rotateY(ry).translate(x, y, z));
  if (lod < 2) {
    // The hair: the tragic mask's onkos high over the brow, the comic's curls round it.
    const h = new SphereGeometry(tragic ? 0.1 : 0.11, lod === 0 ? 9 : 5, lod === 0 ? 5 : 3, 0, Math.PI * 2, 0, Math.PI * 0.55);
    h.scale(1, tragic ? 1.3 : 0.7, 0.6);
    h.translate(0, tragic ? 0.09 : 0.1, -0.02);
    out.paint.push(tintGeometry(boxUV(h), () => lin(hair)).rotateY(ry).translate(x, y, z));
  }
  // The peg.
  out.wood.push(staff([0, 0.12, -0.08], [0, 0.12, 0.0], 0.008, 4).rotateY(ry).translate(x, y, z));
}

/**
 * A long robe (the tragic actor's syrma, with its sleeves) hung over a rail
 * at (x, y, z), the rail along x unless `ry`: a sheet falling in folds to
 * `drop`, its colour in the vertices (cloth).
 */
export function hungRobe(out, x, y, z, ry, colour, lod, { drop = 1.35, w = 0.62, seed = 1 } = {}) {
  const rows = lod === 0 ? 8 : 3;
  const cols = lod === 0 ? 10 : 4;
  const c = lin(colour);
  for (const face of [1, -1]) {
    const g = new BoxGeometry(1, 1, 1, cols, rows, 1);
    // (A thin sheet: the box's front or back face only, folded.)
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + 0.5;
      const v = 0.5 - p.getY(i);
      const flare = 1 + 0.25 * v;
      const fold = (lod === 0 ? 0.035 : 0.02) * Math.sin(u * 14 + seed) * (0.4 + v);
      p.setXYZ(i, (u - 0.5) * w * flare, -v * drop, p.getZ(i) * 0.02 + fold + face * 0.01);
    }
    g.computeVertexNormals();
    boxUV(g);
    out.cloth.push(tintGeometry(g, (px, py) => {
      const k = 0.8 + 0.2 * Math.sin(px * 40 + seed);
      // A border band at the hem (the syrma's), the colour darker.
      const hem = py < -drop + 0.12 ? 0.6 : 1;
      return [c[0] * k * hem, c[1] * k * hem, c[2] * k * hem];
    }).rotateY(ry).translate(x, y, z));
  }
}

/** A wig on its stand: a turned post with a head of wood, the wig of dark hair over it. */
export function wigStand(out, x, z, lod, hair = 0x2a1a10, h = 1.25) {
  out.wood.push(cyl(0.12, 0.14, 0.04, 8, x, 0, z, 0.7), cyl(0.025, 0.03, h - 0.14, 6, x, 0.04, z, 0.75));
  const head = new SphereGeometry(0.1, lod === 0 ? 10 : 6, lod === 0 ? 7 : 4);
  head.scale(0.85, 1.1, 0.95);
  head.translate(x, h, z);
  out.paint.push(tintGeometry(boxUV(head), () => lin(0xb8956a)));
  const wig = new SphereGeometry(0.115, lod === 0 ? 10 : 6, lod === 0 ? 6 : 3, 0, Math.PI * 2, 0, Math.PI * 0.6);
  wig.scale(0.9, 1.25, 1.05);
  wig.translate(x, h + 0.02, z - 0.015);
  out.paint.push(tintGeometry(boxUV(wig), (px, py) => {
    const c = lin(hair);
    const k = 0.75 + 0.25 * Math.sin(py * 140 + px * 60);
    return [c[0] * k, c[1] * k, c[2] * k];
  }));
}

// ---------------------------------------------------------------------------
// Victories
// ---------------------------------------------------------------------------

/**
 * A palm of victory (a racing win's, a gladiator's): its stalk from (x, y, z)
 * curving over toward +x of its own frame, turned ry, `h` long, the leaflets
 * paired along it; the dried trophy's dull green-gold in the vertices.
 */
export function palm(out, x, y, z, ry, h, lod, { lean = 0.5 } = {}) {
  const n = lod === 0 ? 9 : lod === 1 ? 5 : 3;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const v = i / n;
    pts.push([Math.sin(lean * v) * h * v * 0.5, v * h * (1 - 0.15 * v), 0]);
  }
  const g = [];
  for (let i = 0; i < n; i++) g.push(staff(pts[i], pts[i + 1], 0.012 * (1 - i / (n + 1)), 4));
  if (lod < 2) {
    for (let i = 1; i < n; i++) {
      const v = i / n;
      const l = 0.24 * Math.sin(Math.PI * Math.min(1, v * 1.1));
      for (const side of [-1, 1]) {
        const leaf = box(l, 0.004, 0.035, 0, 0, 0, 1);
        leaf.translate(side * l / 2, 0, 0);
        leaf.rotateZ(side * (0.55 + 0.4 * v));
        leaf.rotateY(0.6);
        leaf.translate(pts[i][0], pts[i][1], 0);
        g.push(leaf);
      }
    }
  }
  for (const q of g) out.leaf.push(tintGeometry(q, (px, py) => [0.16 + 0.1 * (py / h), 0.17 + 0.05 * (py / h), 0.06]).rotateY(ry).translate(x, y, z));
}

/** A wreath (corona) of leaves hung at (x, y, z) on a wall facing ry, radius r; gold leaves (`gold`) or laurel. */
export function wreath(out, x, y, z, ry, r, lod, { gold = false } = {}) {
  const t = new TorusGeometry(r, r * 0.16, lod === 0 ? 5 : 3, lod === 0 ? 18 : 9);
  const p = t.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getY(i), p.getX(i));
    const k = lod === 0 ? 1 + 0.25 * Math.max(0, Math.sin(a * 14)) : 1;
    const q = Math.hypot(p.getX(i), p.getY(i));
    const rr = r + (q - r) * k;
    p.setXY(i, Math.cos(a) * rr, Math.sin(a) * rr);
  }
  t.computeVertexNormals();
  boxUV(t);
  const g = tintGeometry(t, () => (gold ? [1, 0.8, 0.35] : [0.1, 0.17, 0.06])).rotateY(ry).translate(x, y, z);
  (gold ? out.gilt : out.leaf).push(g);
  // Its ribbons hanging below.
  if (lod === 0) for (const s of [-1, 1]) out.cloth.push(tintGeometry(box(0.03, 0.22, 0.006, s * 0.03, -r - 0.2, 0.01), () => lin(0xa3352b)).rotateY(ry).translate(x, y, z));
}

/** A painted board (tabula) on a wall facing +z at (x, y, z): w x h, its ground `colour`, its frame red. */
export function board(out, x, y, z, w, h, colour = 0xece4d0) {
  out.wood.push(box(w + 0.08, h + 0.08, 0.04, x, y - 0.04, z, 0.6));
  out.paint.push(tintGeometry(box(w, h, 0.01, x, y, z + 0.025), () => lin(colour)));
}

export { ConeGeometry };
