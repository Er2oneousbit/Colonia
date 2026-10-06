/**
 * models/forum.js
 * ----------------------------------------------------------------------------
 * The forum of the 3D look: in this game the building that registers the
 * households and collects the taxes, so here a town's tax office, 2 x 2
 * tiles (8 m square), from what survives of Roman civic offices rather
 * than from the 2D sprite:
 *
 *   - A low podium of travertine with two steps up from the street, as the
 *     buildings round a forum stood (Pompeii's municipal offices at the
 *     south end of its forum, Rome's Tabularium, the archive, on its high
 *     base over the Forum).
 *   - At the back, the office (a statio of the tax collectors, a tabularium
 *     for the census and the tax rolls): stuccoed walls painted as Pompeii's
 *     public buildings were (a dark socle, a red dado, cream above), three
 *     doorways with travertine jambs and lintels and panelled wooden doors,
 *     a tiled gable roof.
 *   - Before it a portico of four Tuscan columns of travertine carrying an
 *     architrave with an inscription (its letters cut and painted red, as
 *     Roman inscriptions were; abstract here, no words), a lean-to roof.
 *   - In the court: the counting table (mensa) where the money is taken,
 *     as the relief of the rent payment from Neumagen shows it: a marble
 *     table, piles of bronze and silver coin, an open purse, a tablet and a
 *     balance; the strongbox (arca) of wood bound in iron; a tribunal (the
 *     raised platform a magistrate sat on, his folding curule chair on it);
 *     an honorary statue of a togate citizen on an inscribed base.
 *
 * States (meshes tagged in userData.when): 'open', staffed: the doors
 * stand open on the dark office, the clerk stands at the table counting,
 * a citizen pays, coin and purse and tablet lie on the table, the
 * strongbox's lid is up over its coin; 'shut', no staff: the doors closed,
 * the table bare, the strongbox shut, nobody there.
 *
 * In metres, y up, the footprint's middle at the origin (-4..4), the front
 * (the steps) toward +z, as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, CylinderGeometry, BufferGeometry, Float32BufferAttribute, BoxGeometry } from 'three';
import { revolve, profileOf, merge, tintGeometry, boxUV, triangles, tube } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, tuscanColumn, tiledRoof, wallWithOpenings } from './masonry.js';
import { buildFigure } from './figure.js';
import { artRng } from '../texgen.js';

/** The forum's key measures (metres): tests and the lab read them. */
export const FORUM = Object.freeze({
  half: 4,
  podium: 0.3, // the court's floor
  stepZ: 3.55, // the podium's front edge (the steps run on to the footprint's edge)
  officeZ: [-3.9, -1.1], // the office's back and front walls' faces
  eave: 4.0,
  ridge: 4.85,
  colZ: -0.05,
  /** Where the lamps hang by the middle door (x, y, z): the game's night lights read them. */
  lamps: Object.freeze([Object.freeze([-0.95, 2.55, -0.98]), Object.freeze([0.95, 2.55, -0.98])]),
});

const D = (deg) => (deg * Math.PI) / 180;

/** The forum's state from the sim: open (staffed) or shut. */
export function forumState(b) {
  return b.efficiency > 0 ? 'open' : 'shut';
}

/** Does a part tagged `when` show in `state`? */
export function forumShows(when, state) {
  if (!when || when === 'always') return true;
  return when === state;
}

/** A panelled door leaf w x h (its hinge at x = 0, the leaf toward +x), studded. */
function doorLeaf(w, h, seed, lod) {
  const wood = [];
  const studs = [];
  wood.push(slab(w, h, 0.06, { bevel: 0.006, seed, wobble: 0.001, tone: 0.06, grime: 0.2 }).translate(w / 2, 0, 0));
  if (lod < 2) {
    // Raised panels: two over two, the frame round them.
    for (const [px, py] of [[0.27, 0.22], [0.73, 0.22], [0.27, 0.62], [0.73, 0.62]]) {
      wood.push(slab(w * 0.36, h * 0.3, 0.02, { bevel: 0.006, seed: seed + px * 10 + py * 20, wobble: 0, tone: 0.04, grime: 0 }).translate(w * px, h * py, 0.035));
    }
    if (lod === 0) {
      for (const y of [0.08, 0.46, 0.92]) {
        for (const x of [0.12, 0.5, 0.88]) {
          const s = new CylinderGeometry(0.014, 0.018, 0.012, 6);
          s.rotateX(Math.PI / 2);
          studs.push(tintGeometry(boxUV(s.translate(w * x, h * y, 0.04))));
        }
      }
    }
  }
  return { wood, studs };
}

/** Stacks of coin on the table: `n` piles about (x, z) at height y, bronze and silver. */
function coins(n, x, y, z, seed, lod) {
  const rnd = artRng(seed);
  const bronze = [];
  const silver = [];
  for (let k = 0; k < n; k++) {
    const h = 0.004 * (3 + Math.floor(rnd() * 12));
    const r = 0.012 + rnd() * 0.006;
    const g = new CylinderGeometry(r, r, h, lod ? 6 : 10);
    // Coins stacked unevenly: the column's sides ridged by the light.
    g.translate(x + (k % 4) * 0.045 + (rnd() - 0.5) * 0.01, y + h / 2, z + Math.floor(k / 4) * 0.045 + (rnd() - 0.5) * 0.01);
    const out = tintGeometry(boxUV(g), () => 0.85 + rnd() * 0.2);
    (rnd() < 0.4 ? silver : bronze).push(out);
  }
  return { bronze, silver };
}

/** The office: walls with three doorways, the roof, the inside's darkness, the doors open and shut. */
function office(lod, seed) {
  const out = { plaster: [], trav: [], tiles: [], dark: [], wood: [], woodOpen: [], woodShut: [], bronze: [], bronzeOpen: [], bronzeShut: [] };
  const [zb, zf] = FORUM.officeZ;
  const y0 = FORUM.podium;
  const top = FORUM.eave;
  const t = 0.45;
  const W = 7.4;
  const doors = [{ x: 0, w: 1.3, h: 2.45 }, { x: -2.25, w: 0.85, h: 2.05 }, { x: 2.25, w: 0.85, h: 2.05 }];
  // The front wall with its doorways; the back and the ends plain.
  const front = wallWithOpenings(W, top - y0, t, doors, { lod, y0 });
  boxUV(front, 0, -y0);
  out.plaster.push(front.translate(0, 0, zf));
  const back = slab(W, top - y0, t, { bevel: 0.005, seed, wobble: 0, tone: 0, grime: 0.2 });
  out.plaster.push(boxUV(back, 0, -y0).translate(0, y0, zb + t / 2));
  for (const s of [-1, 1]) {
    const end = slab(t, top - y0, zf - zb - 2 * t + 0.002, { bevel: 0.005, seed: seed + s, wobble: 0, tone: 0, grime: 0.2 });
    out.plaster.push(boxUV(end, 0, -y0).translate(s * (W / 2 - t / 2), y0, (zb + zf) / 2));
  }
  // The gable ends over the walls: triangles of plaster up to the ridge.
  const zr = (zb + zf) / 2;
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - t / 2);
    const g = new BufferGeometry();
    const p = [[x, top, zb], [x, top, zf], [x, FORUM.ridge - 0.08, zr]];
    const pos = s > 0 ? [...p[0], ...p[2], ...p[1]] : [...p[0], ...p[1], ...p[2]];
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    out.plaster.push(tintGeometry(boxUV(g, 0, -y0)));
  }
  // The dark inside (seen through the open doors): a box turned inside out, lined dark.
  const room = new BoxGeometry(W - 2 * t - 0.02, top - y0 - 0.3, zf - zb - 2 * t - 0.02);
  const idx = room.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const k = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = k;
  }
  room.translate(0, y0 + (top - y0 - 0.3) / 2 + 0.01, (zb + zf) / 2);
  room.computeVertexNormals();
  out.dark.push(tintGeometry(boxUV(room)));
  // Travertine door frames: jambs, a lintel with a little cornice, the threshold.
  for (const d of doors) {
    for (const s of [-1, 1]) out.trav.push(slab(0.16, d.h, t + 0.08, { bevel: 0.01, seed: seed + d.x * 7 + s, wobble: 0.002, tone: 0.04, grime: 0.25 }).translate(d.x + s * (d.w / 2 + 0.08), y0, zf - t / 2 + 0.04));
    out.trav.push(slab(d.w + 0.5, 0.24, t + 0.12, { bevel: 0.012, seed: seed + d.x * 9, wobble: 0.002, tone: 0.04, grime: 0 }).translate(d.x, y0 + d.h, zf - t / 2 + 0.06));
    if (lod < 2) out.trav.push(slab(d.w + 0.64, 0.06, t + 0.2, { bevel: 0.01, seed: seed + d.x * 11, wobble: 0.001, tone: 0.03, grime: 0 }).translate(d.x, y0 + d.h + 0.24, zf - t / 2 + 0.1));
    out.trav.push(slab(d.w + 0.1, 0.05, t + 0.14, { bevel: 0.008, seed: seed + d.x * 13, wobble: 0.001, tone: 0.03, grime: 0.1 }).translate(d.x, y0, zf - t / 2 + 0.06));
    // The doors: two leaves for the middle one, one for each side door. Open: swung in against the jambs' insides.
    const leaves = d.w > 1 ? [[-1, d.w / 2], [1, d.w / 2]] : [[-1, d.w]];
    for (const [s, w] of leaves) {
      for (const open of [false, true]) {
        const l = doorLeaf(w - 0.01, d.h - 0.02, seed + d.x * 5 + s, lod);
        const hx = d.x + s * (d.w / 2);
        const turn = (g) => {
          if (s > 0) {
            // A right leaf is the left one mirrored: built from its hinge toward -x.
            g.translate(-w + 0.01, 0, 0);
          }
          g.rotateY(open ? -s * D(100) : 0);
          return g.translate(hx, y0 + 0.02, zf - t + 0.06);
        };
        (open ? out.woodOpen : out.woodShut).push(...l.wood.map(turn));
        (open ? out.bronzeOpen : out.bronzeShut).push(...l.studs.map(turn));
      }
    }
  }
  // The roof: two tiled slopes, the ridge capped; and a cornice of travertine along the eaves.
  const ox = W / 2 + 0.18;
  const front0 = [-ox, top - 0.02, zf + 0.25];
  const front1 = [ox, top - 0.02, zf + 0.25];
  const rid0 = [-ox, FORUM.ridge, zr];
  const rid1 = [ox, FORUM.ridge, zr];
  out.tiles.push(...tiledRoof([front0, front1, rid1, rid0], { lod, seed: seed + 3 }).tiles);
  // (The back eave overhangs only as far as the footprint's edge.)
  out.tiles.push(...tiledRoof([[ox, top - 0.02, zb - 0.06], [-ox, top - 0.02, zb - 0.06], rid0, rid1], { lod, seed: seed + 4 }).tiles);
  if (lod < 2) out.tiles.push(tube([[-ox, FORUM.ridge + 0.03, zr], [ox, FORUM.ridge + 0.03, zr]], 0.08, { radial: lod ? 4 : 8, segments: 2, around: 0.6 }));
  // Lamps by the middle door: bronze brackets and lanterns (lit at night in the game by its light map).
  if (lod < 2) {
    for (const [x, y, z] of FORUM.lamps) {
      out.bronze.push(tube([[x, y + 0.42, zf + 0.01], [x, y + 0.42, z + 0.16], [x, y + 0.36, z]], 0.012, { radial: 4, segments: 4, around: 0.3 }));
      out.bronze.push(revolve(profileOf([[0, 0], [0.07, 0], [0.08, 0.04], [0.06, 0.2], [0.08, 0.24], [0.03, 0.32], [0, 0.34]]), { segments: lod ? 6 : 10, metres: 0.3 }).translate(x, y, z));
    }
  }
  return out;
}

/** The portico: four columns, the architrave with its inscription, the lean-to roof. */
function portico(lod, seed) {
  const out = { trav: [], marble: [], red: [], tiles: [] };
  const y0 = FORUM.podium;
  const z = FORUM.colZ;
  const colH = 2.95;
  for (const x of [-3.1, -1.05, 1.05, 3.1]) for (const g of tuscanColumn(0.17, colH, lod)) out.trav.push(g.translate(x, y0, z));
  const aY = y0 + colH;
  // Architrave, frieze and a projecting cornice.
  out.trav.push(slab(6.9, 0.34, 0.42, { bevel: 0.01, seed: seed + 1, wobble: 0.002, tone: 0.03, grime: 0 }).translate(0, aY, z));
  out.trav.push(slab(7.1, 0.1, 0.56, { bevel: 0.015, seed: seed + 2, wobble: 0.001, tone: 0.02, grime: 0 }).translate(0, aY + 0.34, z + 0.03));
  // The inscription: a marble panel on the architrave's face, its letters in rows of little red-filled cuts.
  out.marble.push(slab(3.2, 0.26, 0.03, { bevel: 0.004, seed: seed + 3, wobble: 0, tone: 0, grime: 0 }).translate(0, aY + 0.04, z + 0.215));
  if (lod === 0) {
    const rnd = artRng(seed + 4);
    let x = -1.48;
    while (x < 1.45) {
      // A word of 3 to 8 letters, a gap (an interpunct) after it.
      const n = 3 + Math.floor(rnd() * 6);
      for (let k = 0; k < n && x < 1.45; k++) {
        const w = 0.028 + rnd() * 0.02;
        out.red.push(slab(w, 0.085, 0.006, { bevel: 0.001, seed: seed + x * 100, wobble: 0, tone: 0.1, grime: 0 }).translate(x + w / 2, aY + 0.125, z + 0.232));
        x += w + 0.018;
      }
      x += 0.06;
    }
  } else if (lod === 1) {
    out.red.push(slab(2.9, 0.13, 0.008, { bevel: 0.001, seed: seed + 5, wobble: 0, tone: 0, grime: 0 }).translate(0, aY + 0.105, z + 0.232));
  }
  // The lean-to roof from the office's front wall down onto the architrave.
  const [, zf] = FORUM.officeZ;
  const x0 = 3.55;
  out.tiles.push(...tiledRoof([[-x0, aY + 0.42, z + 0.32], [x0, aY + 0.42, z + 0.32], [x0, FORUM.eave - 0.02, zf + 0.05], [-x0, FORUM.eave - 0.02, zf + 0.05]], { lod, seed: seed + 6 }).tiles);
  return out;
}

/** The court: the counting table, the strongbox, the tribunal, the statue; what shows when it is open. */
function court(lod, seed) {
  const out = {
    marble: [], lime: [], wood: [], iron: [], ironOpen: [], ironShut: [], woodOpen: [], woodShut: [], bronzeOpen: [], silverOpen: [], cloth: [], leatherOpen: [], bronze: [], tablet: [],
  };
  const y0 = FORUM.podium;
  // The counting table: a marble top on two carved slab supports.
  const tx = -0.55;
  const tz = 1.35;
  const tH = 0.86;
  out.marble.push(slab(1.6, 0.07, 0.78, { bevel: 0.012, seed: seed + 1, wobble: 0.001, tone: 0.02, grime: 0 }).translate(tx, y0 + tH - 0.07, tz));
  for (const s of [-1, 1]) {
    // A trapezophoron: a slab support shaped like an animal's leg, here waisted and footed.
    const leg = revolve(profileOf([[0.0, 0], [0.16, 0], [0.12, 0.08], [0.07, 0.3], [0.1, 0.6], [0.15, tH - 0.07], [0, tH - 0.07]]), { segments: lod ? 4 : 8, metres: 1.6 });
    leg.scale(1, 1, 0.35);
    leg.rotateY(Math.PI / 2);
    out.marble.push(leg.translate(tx + s * 0.62, y0, tz));
  }
  // On it, when the office works: coin, a purse, a tablet, a balance.
  if (lod < 2) {
    const c = coins(lod ? 6 : 14, tx - 0.55, y0 + tH, tz - 0.25, seed + 5, lod);
    out.bronzeOpen.push(...c.bronze);
    out.silverOpen.push(...c.silver);
    // An open purse, coin spilling from it.
    const purse = revolve(profileOf([[0, 0], [0.07, 0.0], [0.1, 0.05], [0.08, 0.12], [0.05, 0.15], [0.07, 0.18], [0, 0.17]]), { segments: lod ? 6 : 10, metres: 0.3 });
    out.leatherOpen.push(purse.translate(tx + 0.2, y0 + tH, tz + 0.1));
    if (lod === 0) {
      const spill = coins(5, tx + 0.28, y0 + tH, tz + 0.14, seed + 9, lod);
      out.bronzeOpen.push(...spill.bronze, ...spill.silver);
    }
    // A writing tablet, open: two leaves of wood with dark wax.
    for (const s of [-1, 1]) out.tablet.push(slab(0.2, 0.012, 0.26, { bevel: 0.002, seed: seed + 7 + s, wobble: 0, tone: 0, grime: 0 }).translate(tx + 0.48 + s * 0.105, y0 + tH, tz - 0.12));
    // The balance: a post, a beam, two pans hung on cords.
    const bx = tx + 0.55;
    const bz = tz + 0.22;
    const bY = y0 + tH;
    out.bronzeOpen.push(tintGeometry(boxUV(new CylinderGeometry(0.012, 0.02, 0.42, 6).translate(bx, bY + 0.21, bz))));
    out.bronzeOpen.push(tintGeometry(boxUV(new CylinderGeometry(0.008, 0.008, 0.46, 5).rotateZ(Math.PI / 2 - 0.08).translate(bx, bY + 0.42, bz))));
    for (const s of [-1, 1]) {
      const px = bx + s * 0.22;
      const py = bY + 0.42 - s * 0.018 - 0.22;
      out.bronzeOpen.push(revolve(profileOf([[0, 0], [0.07, 0.01], [0.08, 0.03], [0, 0.02]]), { segments: lod ? 6 : 10, metres: 0.3 }).translate(px, py, bz));
      if (lod === 0) out.bronzeOpen.push(tube([[px, py + 0.02, bz], [px, bY + 0.42 - s * 0.018, bz]], 0.002, { radial: 3, segments: 1, around: 0.3 }));
    }
  }
  // The strongbox: an iron-bound chest; open, its lid up over its coin; shut, the lid down and padlocked.
  const ax = 1.35;
  const az = 0.95;
  const aw = 1.0;
  const ah = 0.55;
  const ad = 0.6;
  out.wood.push(slab(aw, ah, ad, { bevel: 0.012, seed: seed + 11, wobble: 0.002, tone: 0.04, grime: 0.2 }).translate(ax, y0, az));
  for (const x of [-0.38, 0, 0.38]) out.iron.push(slab(0.05, ah + 0.01, ad + 0.012, { bevel: 0.003, seed: seed + 12, wobble: 0, tone: 0, grime: 0 }).translate(ax + x, y0 - 0.005, az));
  const lidShut = slab(aw + 0.02, 0.12, ad + 0.02, { bevel: 0.012, seed: seed + 13, wobble: 0.001, tone: 0.04, grime: 0 }).translate(ax, y0 + ah, az);
  out.woodShut.push(lidShut);
  for (const x of [-0.38, 0, 0.38]) out.ironShut.push(slab(0.05, 0.13, ad + 0.03, { bevel: 0.003, seed: seed + 14, wobble: 0, tone: 0, grime: 0 }).translate(ax + x, y0 + ah, az));
  out.ironShut.push(slab(0.09, 0.11, 0.03, { bevel: 0.004, seed: seed + 15, wobble: 0, tone: 0, grime: 0 }).translate(ax, y0 + ah - 0.12, az + ad / 2 + 0.01));
  // Open: the lid stood up behind on its hinges, coin heaped inside.
  const lidOpen = slab(aw + 0.02, 0.12, ad + 0.02, { bevel: 0.012, seed: seed + 13, wobble: 0.001, tone: 0.04, grime: 0 });
  lidOpen.translate(0, 0, ad / 2 + 0.01);
  lidOpen.rotateX(-D(100));
  out.woodOpen.push(lidOpen.translate(ax, y0 + ah, az - ad / 2));
  if (lod < 2) {
    const heap = revolve(profileOf([[0, 0], [0.44, 0], [0.38, 0.03], [0.2, 0.08], [0, 0.1]]), { segments: lod ? 6 : 12, metres: 0.3 });
    heap.scale(1.05, 1, 0.6);
    out.bronzeOpen.push(heap.translate(ax, y0 + ah - 0.06, az));
  }
  // The tribunal: a platform with steps, the curule chair on it.
  const rx = -2.65;
  const rz = 2.35;
  out.lime.push(slab(1.9, 0.62, 1.35, { bevel: 0.015, seed: seed + 20, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate(rx, y0, rz));
  out.lime.push(slab(2.0, 0.08, 1.45, { bevel: 0.012, seed: seed + 21, wobble: 0.001, tone: 0.03, grime: 0 }).translate(rx, y0 + 0.62, rz));
  for (let k = 0; k < 3; k++) out.lime.push(slab(0.55, 0.23 * (k + 1), 0.3, { bevel: 0.01, seed: seed + 22 + k, wobble: 0.001, tone: 0.03, grime: 0.2 }).translate(rx + 1.25, y0, rz + 0.45 - k * 0.3));
  if (lod < 2) {
    // The sella curulis: crossed curved legs, a seat of leather.
    const cy = y0 + 0.7;
    for (const s of [-1, 1]) {
      for (const zz of [-0.18, 0.18]) out.bronze.push(tube([[rx - 0.24 * s, cy, rx * 0 + rz + zz], [rx - 0.05 * s, cy + 0.2, rz + zz], [rx + 0.24 * s, cy + 0.45, rz + zz]], 0.018, { radial: lod ? 4 : 6, segments: lod ? 3 : 6, around: 0.3 }));
    }
    out.cloth.push(slab(0.55, 0.04, 0.42, { bevel: 0.01, seed: seed + 25, wobble: 0.004, tone: 0, grime: 0 }).translate(rx, cy + 0.42, rz));
  }
  // The honorary statue on its inscribed base.
  const sx = 2.65;
  const sz = 2.75;
  out.marble.push(slab(0.95, 0.18, 0.95, { bevel: 0.02, seed: seed + 30, wobble: 0.001, tone: 0, grime: 0.3 }).translate(sx, y0, sz));
  out.marble.push(slab(0.75, 1.0, 0.75, { bevel: 0.006, seed: seed + 31, wobble: 0.001, tone: 0, grime: 0.15 }).translate(sx, y0 + 0.18, sz));
  out.marble.push(slab(0.95, 0.16, 0.95, { bevel: 0.02, seed: seed + 32, wobble: 0.001, tone: 0, grime: 0 }).translate(sx, y0 + 1.18, sz));
  return out;
}

/** A figure's meshes as geometry lists by material, placed (x, y, z), turned `ry`, at `scale`. */
function figureParts(opts, x, y, z, ry, scale = 1) {
  const f = buildFigure(opts);
  f.scale.setScalar(scale);
  f.rotation.y = ry;
  f.position.set(x, y, z);
  f.updateMatrixWorld(true);
  const parts = [];
  f.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    parts.push({ g, material: o.material });
  });
  f.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  return parts;
}

/** Build the forum: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildForum({ lod = 0, seed = 61 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const group = new Group();
  group.name = 'forum';
  const meshes = [];
  const add = (geos, mat, name, when = 'always', cast = true) => {
    const list = geos.filter(Boolean);
    if (!list.length) return null;
    const m = new Mesh(merge(list), mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    m.userData.when = when;
    group.add(m);
    meshes.push(m);
    return m;
  };
  const H = FORUM.half;
  const y0 = FORUM.podium;
  const trav = [];
  // The podium: a core faced with travertine blocks, two steps along the front, paving on top.
  const pz0 = -H + 0.02;
  const pz1 = FORUM.stepZ;
  trav.push(slab(2 * H - 0.04, y0 - 0.05, pz1 - pz0, { bevel: 0.01, seed, wobble: 0.002, tone: 0.03, grime: 0.35 }).translate(0, 0, (pz0 + pz1) / 2));
  // The steps: the upper one under the podium's lip, the lower one before it, in seeded lengths.
  const steps = [[pz1, pz1 + 0.22, 0.17], [pz1 + 0.22, H - 0.02, 0.085]];
  steps.forEach(([za, zb2, h], i) => {
    let x = -H + 0.02;
    const rnd = artRng(seed + 40 + i);
    while (x < H - 0.03) {
      const xb = Math.min(H - 0.02, x + 0.9 + rnd() * 0.7);
      trav.push(slab(xb - x - 0.008, h, zb2 - za - 0.004, { bevel: 0.012, seed: seed + 50 + i * 20 + x * 3, wobble: 0.003, tone: 0.05, grime: 0.3 }).translate((x + xb) / 2, 0, (za + zb2) / 2));
      x = xb;
    }
  });
  trav.push(...paving(-H + 0.02, H - 0.02, pz0, pz1, 0.05, seed + 2, { rowW: 0.7, minL: 0.7, maxL: 1.3, lod, skip: (x, z) => z < FORUM.officeZ[1] - 0.3 }).map((g) => g.translate(0, y0 - 0.05, 0)));
  const of = office(lod, seed + 3);
  const po = portico(lod, seed + 4);
  const co = court(lod, seed + 5);
  add([...trav, ...po.trav, ...of.trav], material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 }), 'stone');
  add(of.plaster, material('plaster', { surface: 'plaster', vertexColors: true, snow: 1 }), 'walls');
  add([...of.tiles, ...po.tiles], material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 1 }), 'roof');
  add(of.dark, material('room-dark', { color: 0x0e0b09, roughness: 1, snow: 0, wet: 0 }), 'inside', 'always', false);
  add(of.wood, material('wood', { surface: 'wood', vertexColors: true, snow: 1 }), 'wood');
  add([...of.woodOpen, ...co.woodOpen], material('wood', { surface: 'wood', vertexColors: true, snow: 1 }), 'doors-open', 'open');
  add([...of.woodShut, ...co.woodShut], material('wood', { surface: 'wood', vertexColors: true, snow: 1 }), 'doors-shut', 'shut');
  add(co.wood, material('wood', { surface: 'wood', vertexColors: true, snow: 1 }), 'strongbox');
  add([...of.bronze, ...co.bronze], material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }), 'bronze');
  add([...of.bronzeOpen, ...co.bronzeOpen], material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }), 'coin', 'open');
  add(of.bronzeShut, material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }), 'studs-shut', 'shut');
  add(co.silverOpen, material('silver', { color: 0xd4d4d8, roughness: 0.32, metalness: 1, snow: 0.5 }), 'silver', 'open');
  add([...po.marble, ...co.marble], material('marble', { surface: 'marble', vertexColors: true, snow: 1 }), 'marble');
  add(po.red, material('inscription-red', { color: 0x6a1e14, roughness: 0.8, snow: 0.3 }), 'inscription');
  add(co.lime, material('limestone', { surface: 'limestone', vertexColors: true, snow: 1 }), 'tribunal');
  add(co.iron, material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }), 'iron');
  add(co.ironShut, material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }), 'iron-shut', 'shut');
  add(co.cloth, material('cloth-dyed', { surface: 'wool', vertexColors: true, snow: 0.7 }), 'seat');
  add(co.leatherOpen, material('leather', { color: 0x3b2a1e, roughness: 0.65, snow: 0.2 }), 'purse', 'open');
  add(co.tablet, material('wax-tablet', { color: 0x2a2018, roughness: 0.5, snow: 0.3 }), 'tablet', 'open');
  // People: the clerk counting at the table and a citizen paying (open); the statue on its base (always).
  if (lod === 0) {
    const people = [
      ...figureParts({ cloth: 0xd8d0bc, reach: 0.7 }, -0.55, y0, 0.75, 0.0),
      ...figureParts({ cloth: 0x7a5a3a, cloth2: 0x5a4a38, reach: 0.5 }, -0.85, y0, 2.15, Math.PI + 0.3),
    ];
    for (const p of people) add([p.g], p.material, `person-${p.material.name}`, 'open');
  }
  if (lod < 2) {
    const statue = figureParts({ long: true, cloth2: 0xffffff, reach: 0.45 }, 2.65, y0 + 1.34, 2.75, 0.25, 0.98).map((p) => p.g);
    add(statue, material('marble', { surface: 'marble', vertexColors: true, snow: 1 }), 'statue');
  }
  let tris = 0;
  for (const m of meshes) tris += triangles(m.geometry);
  return { group, meshes, triangles: tris };
}

/** Show a state on a built forum (the lab): 'open' or 'shut'. */
export function setForumState(f, state) {
  for (const m of f.meshes) m.visible = forumShows(m.userData.when, state);
}
