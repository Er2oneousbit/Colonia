/**
 * models/castra.js
 * ----------------------------------------------------------------------------
 * What the three forts of the 3D look share (castraLegion.js, castraArcher.js,
 * castraEquitum.js): the plan of a Roman fort shrunk onto a 3 x 3 footprint
 * (12 m), its rampart and towers, its gate, its standards and the soldiers'
 * blocks, from the excavated forts rather than the 2D sprite.
 *
 * The record. Polybius (book 6) and the treatise on camps that goes under
 * Hyginus's name lay a camp out round two streets crossing before the
 * headquarters; the permanent forts of the frontiers keep that plan in
 * miniature (Housesteads and Chesters on Hadrian's Wall, the Saalburg on the
 * German limes, Vindolanda): a rampart round a "playing card" with a tower
 * at each corner and towers either side of each gate; inside, the
 * headquarters (principia) facing the main gate across the yard, with the
 * shrine of the standards (aedes) in its middle at the back; barrack blocks
 * of eight-man rooms (contubernia); ovens and water tanks along the rampart.
 * The milecastles of Hadrian's Wall are the same thing at the size of a
 * hamlet: a walled yard 15 by 18 m, a gate, one or two small blocks.
 *
 * The game's own constraint. The soldiers at rest stand in the yard
 * (sim/forts.js yardSpot, data/units.js FORT_YARD), drawn by the game over
 * the model, and the camera looks down at 30 degrees from any of the four
 * corners: a thing of height h hides the ground up to 1.7 h behind it. So
 * the forts are built low where the men stand: the wall-walk at 1 m behind
 * a parapet a little over 1.4 m (merlons 1.75), corner towers and gate towers
 * near 3 m, the headquarters pushed against the back rampart, the blocks
 * along the sides; every yard spot is checked from every side
 * (tests/military3d.test.mjs yardHidden). The rampart is a stone curtain
 * with an earth bank behind it, as the stone forts had (the bank carried the
 * walk, and its slope hides less of the yard than a wall would).
 *
 * Everything here is in metres in the frame of the front side (along x, the
 * outside toward +z) and turned onto the other sides by quarter turns
 * (onSide): the rampart is four runs of one design, the gate on the front.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, SphereGeometry, BufferGeometry, Float32BufferAttribute, Shape, ExtrudeGeometry, ConeGeometry, TorusGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { material, DoubleSide, waterMaterial } from '../materials.js';
import { artRng } from '../texgen.js';
import { slab, paving, GLYPHS, tiledRoof, TaggedParts, lantern, lanternPane } from './masonry.js';
import { blk, beam, lin, D, gableRoof } from './rural.js';
import { figureParts } from './figure.js';

/** The fort's plan (metres from the middle; the gate's side, +z, is the front). */
export const CASTRA = Object.freeze({
  /** The rampart's outer face. */
  O: 5.85,
  /** A corner tower's side (its outer faces flush with the rampart's). */
  tower: 1.6,
  /** Half the gate's passage: FORT_GATEWAY's 0.64 tile, the opening the men walk through. */
  gateHalf: 1.28,
  /**
   * A gate tower's width (along the front) and its inner face (toward the
   * yard): slim and set out at the front, so a man standing near the gate
   * inside is not hidden behind its towers from either front corner.
   */
  gateTower: 1.0,
  gateIn: 5.0,
  /** The yard's floor: trodden gravel just over the ground. */
  floorY: 0.03,
});

const C = CASTRA;

/** A box w x h x d, its foot at (x, y, z): UVs in metres, a vertex colour of `k`. */
export function box(w, h, d, x, y, z, k = 1) {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return tintGeometry(boxUV(g), typeof k === 'function' ? k : () => k);
}

/** A cylinder (radii rt, rb, height h) standing on (x, y, z). */
export function cyl(rt, rb, h, seg, x, y, z, k = 1) {
  const g = new CylinderGeometry(rt, rb, h, seg, 1);
  g.translate(x, y + h / 2, z);
  return tintGeometry(boxUV(g), () => k);
}

/** A round staff from a to b ([x, y, z]), radius r (a spear, a standard's pole). */
export function staff(a, b, r, radial = 6) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const g = new CylinderGeometry(r, r, len, radial, 1);
  g.translate(0, len / 2, 0);
  g.rotateX(Math.acos(Math.max(-1, Math.min(1, dy / len))));
  g.rotateY(Math.atan2(dx, dz));
  g.translate(a[0], a[1], a[2]);
  return tintGeometry(boxUV(g));
}

/** Turn geometries built on the front side (outside toward +z) onto side k: 0 front, 1 the +x side, 2 the back, 3 the -x side. */
export function onSide(geos, k) {
  for (const g of geos) if (k & 3) g.rotateY((k & 3) * (Math.PI / 2));
  return geos;
}

/** A face stone w x h, `depth` deep, its face toward +z at z = 0 (going back to -depth), centred on x and y: a bevel framing the face. */
export function faceStone(w, h, depth, seed, k = 0.06) {
  const g = slab(w, depth, h, { bevel: Math.min(0.025, w * 0.12, h * 0.12), seed, wobble: 0.004, tone: k, grime: 0 });
  // (slab's chamfered top turned to face +z.)
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, -depth);
  return g;
}

/**
 * Courses of face stones over the rectangle x0..x1, y0..y1 of a face at
 * z (facing +z), `course` high, of seeded lengths about `len`, each course
 * offset from the one below (the joints broken, as a mason lays them).
 */
export function ashlar(x0, x1, y0, y1, z, { course = 0.28, len = 0.52, seed = 1, depth = 0.08, tone = 0.07 } = {}) {
  const rnd = artRng(seed);
  const out = [];
  const rows = Math.max(1, Math.round((y1 - y0) / course));
  const ch = (y1 - y0) / rows;
  const gap = 0.012;
  for (let r = 0; r < rows; r++) {
    let x = x0;
    // (Half a stone's offset every other course.)
    if (r % 2) x = Math.min(x1, x0 + len * (0.35 + rnd() * 0.3));
    const yc = y0 + (r + 0.5) * ch;
    if (x > x0 + 0.02) {
      out.push(faceStone(x - x0 - gap, ch - gap, depth, seed + r * 97, tone).translate((x0 + x) / 2, yc, z));
    }
    while (x < x1 - 0.02) {
      let xb = Math.min(x1, x + len * (0.75 + rnd() * 0.5));
      if (x1 - xb < len * 0.4) xb = x1;
      out.push(faceStone(xb - x - gap, ch - gap * (0.8 + rnd() * 0.4), depth, seed + r * 97 + Math.round(x * 31), tone).translate((x + xb) / 2, yc, z));
      x = xb;
    }
  }
  return out;
}

/**
 * A prism along x from a0 to a1 whose cross-section is the polygon `sec`
 * ([[z, y], ...], counter-clockwise seen from +x), closed at both ends: a
 * bank of earth, a sloping coping. UVs in metres, a vertex colour f(x, y, z).
 */
export function prism(a0, a1, sec, f = null) {
  const pos = [];
  const n = sec.length;
  const quad = (p, q, r, s) => pos.push(...p, ...q, ...r, ...p, ...r, ...s);
  for (let i = 0; i < n; i++) {
    const [z0, y0] = sec[i];
    const [z1, y1] = sec[(i + 1) % n];
    quad([a0, y0, z0], [a0, y1, z1], [a1, y1, z1], [a1, y0, z0]);
  }
  // The ends: a fan (the sections are convex).
  for (let i = 1; i < n - 1; i++) {
    pos.push(a1, sec[0][1], sec[0][0], a1, sec[i][1], sec[i][0], a1, sec[i + 1][1], sec[i + 1][0]);
    pos.push(a0, sec[0][1], sec[0][0], a0, sec[i + 1][1], sec[i + 1][0], a0, sec[i][1], sec[i][0]);
  }
  // (Each triangle wound to face away from the middle: the sections are convex.)
  const cy = sec.reduce((a, q) => a + q[1], 0) / n;
  const cz = sec.reduce((a, q) => a + q[0], 0) / n;
  outward(pos, [(a0 + a1) / 2, cy, cz]);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  boxUV(g);
  return tintGeometry(g, f);
}

/**
 * Lift a geometry's UVs by `dv` metres up the plaster's painted zones
 * (surfaces.js plaster: a dark socle and a red dado in its lowest 1.36 m
 * of every 4): a limewashed wall shows the cream above them.
 */
export function limewash(g, dv = 1.45) {
  if (g.userData.limewashed) return g;
  g.userData.limewashed = true;
  const uv = g.attributes.uv;
  const n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    // (A top's v runs along the ground, through every zone: kept in the cream.)
    if (Math.abs(n.getY(i)) > 0.7) uv.setY(i, 1.6 + (((uv.getY(i) % 2) + 2) % 2));
    else uv.setY(i, uv.getY(i) + dv);
  }
  return g;
}

/** Turn a geometry's faces the other way (its inside out). */
export function flipFaces(g) {
  if (g.index) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    g.index.needsUpdate = true;
  } else {
    for (const name of Object.keys(g.attributes)) {
      const at = g.attributes[name];
      const n = at.itemSize;
      for (let i = 0; i < at.count; i += 3) {
        for (let k = 0; k < n; k++) {
          const t = at.array[(i + 1) * n + k];
          at.array[(i + 1) * n + k] = at.array[(i + 2) * n + k];
          at.array[(i + 2) * n + k] = t;
        }
      }
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Mirror geometries across x = 0 (scale -1 turns their faces inside out: wound back, normals kept). */
export function mirrorX(geos) {
  for (const g of geos) {
    g.scale(-1, 1, 1);
    if (g.index) {
      const a = g.index.array;
      for (let i = 0; i < a.length; i += 3) {
        const t = a[i + 1];
        a[i + 1] = a[i + 2];
        a[i + 2] = t;
      }
    } else {
      for (const name of Object.keys(g.attributes)) {
        const at = g.attributes[name];
        const n = at.itemSize;
        for (let i = 0; i < at.count; i += 3) {
          for (let k = 0; k < n; k++) {
            const t = at.array[(i + 1) * n + k];
            at.array[(i + 1) * n + k] = at.array[(i + 2) * n + k];
            at.array[(i + 2) * n + k] = t;
          }
        }
      }
    }
  }
  return geos;
}

/** Wind every triangle of a flat position list to face away from point c (a convex solid's middle). */
export function outward(pos, c) {
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i]; const ay = pos[i + 1]; const az = pos[i + 2];
    const ux = pos[i + 3] - ax; const uy = pos[i + 4] - ay; const uz = pos[i + 5] - az;
    const vx = pos[i + 6] - ax; const vy = pos[i + 7] - ay; const vz = pos[i + 8] - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const mx = (ax + pos[i + 3] + pos[i + 6]) / 3 - c[0];
    const my = (ay + pos[i + 4] + pos[i + 7]) / 3 - c[1];
    const mz = (az + pos[i + 5] + pos[i + 8]) / 3 - c[2];
    if (nx * mx + ny * my + nz * mz < 0) {
      for (let k = 0; k < 3; k++) {
        const t = pos[i + 3 + k];
        pos[i + 3 + k] = pos[i + 6 + k];
        pos[i + 6 + k] = t;
      }
    }
  }
  return pos;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/** The forts' materials (shared by key with the other models: one program for all). */
export function castraMaterials() {
  return {
    // The fort's dressed stone: a buff sandstone, as the Wall's.
    ashlar: material('fort-sandstone', { surface: 'limestone', color: 0xe6d6b4, vertexColors: true, snow: 1 }),
    // The wall's core and the mortar behind the facing: rubble in lime.
    core: material('rubble-wall', { surface: 'rubble', vertexColors: true, snow: 1 }),
    stone: material('limestone', { surface: 'limestone', vertexColors: true, snow: 1 }),
    // Flags underfoot (the walk, the gate's passage, a paved street): a worn grey-buff.
    flags: material('fort-flags', { surface: 'limestone', color: 0xb8ab94, vertexColors: true, snow: 0.8 }),
    trav: material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 }),
    plaster: material('plaster', { surface: 'plaster', vertexColors: true, snow: 1 }),
    red: material('stucco-red', { surface: 'plaster', color: 0xc0644a, vertexColors: true, snow: 1 }),
    wood: material('wood', { surface: 'wood', vertexColors: true, snow: 1 }),
    tile: material('roof-tile', { surface: 'terracotta', vertexColors: true, snow: 1 }),
    clay: material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 0.8 }),
    thatch: material('thatch', { surface: 'thatch', vertexColors: true, snow: 1 }),
    // The rampart's bank: cut turves, green going brown, laid in courses.
    turf: material('turf', { surface: 'earth', color: 0xb4c27e, vertexColors: true, snow: 1 }),
    earth: material('beaten-earth', { surface: 'earth', vertexColors: true, snow: 1 }),
    gravel: material('fort-gravel', { surface: 'earth', color: 0xd9c9a8, vertexColors: true, snow: 1 }),
    iron: material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }),
    bronze: material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }),
    // The eagle and the standards' fittings: gilt bronze.
    gilt: material('gilt', { surface: 'bronze', color: 0xffcf6a, rough: 0.6, vertexColors: true, snow: 0.5 }),
    silver: material('silvered', { surface: 'iron', color: 0xe8e8ee, rough: 0.5, vertexColors: true, snow: 0.5 }),
    marble: material('marble', { surface: 'marble', vertexColors: true, snow: 1 }),
    letters: material('inscription-red', { color: 0x6a1e14, roughness: 0.8, snow: 0.3 }),
    rope: material('rope', { surface: 'rope', vertexColors: true, snow: 0.6, normal: 1 }),
    leather: material('tent-leather', { surface: 'wool', color: 0xe6cfa6, vertexColors: true, snow: 1 }),
    // A dyed cloth (flags, cloaks, the vexillum's): its colour in its vertices.
    cloth: material('cloth-dyed', { surface: 'wool', vertexColors: true, snow: 0.7 }),
    // Plain colours carried by the vertices (straw targets, the shields' paint).
    paint: material('paint', { color: 0xffffff, roughness: 0.6, vertexColors: true, snow: 0.8 }),
    straw: material('straw', { surface: 'rope', color: 0xf0dc98, vertexColors: true, snow: 1 }),
    hay: material('hay', { surface: 'thatch', color: 0xc4ad7c, vertexColors: true, snow: 1 }),
    dark: material('room-dark', { color: 0x0e0b09, roughness: 1, snow: 0, wet: 0 }),
    water: null, // (the look's water: taken by the model that has a tank)
  };
}

// ---------------------------------------------------------------------------
// The rampart
// ---------------------------------------------------------------------------

/**
 * A stone rampart's run on the front side, from x a0 to a1: the curtain
 * (its outer face at O, `wallT` thick, up to the walk), the parapet on its
 * outer edge with merlons, the earth bank behind it sloping down to the
 * yard, a walk of flags on top. `skip` [x0, x1]: no merlons there (a gate's
 * towers). `out` gets lists by material key: ashlar, core, turf, stone.
 */
export function stoneRun(a0, a1, { lod, seed, out, walk = 1.0, par = 1.45, merlon = 1.75, wallT = 0.55, parT = 0.24, bankFoot = 4.75, facing = 'ashlar', plain = false, skip = null } = {}) {
  const O = C.O;
  const zi = O - wallT;
  const zp = O - parT;
  // The core: the wall up to the walk, the parapet over its outer edge (the mortar a shade behind the facing).
  out.core.push(box(a1 - a0, walk, wallT - 0.04, (a0 + a1) / 2, 0, O - wallT / 2 - 0.02, 0.7));
  out.core.push(box(a1 - a0, par - walk, parT - 0.05, (a0 + a1) / 2, walk, O - parT / 2 - 0.025, 0.75));
  if (lod === 0 && !plain) {
    // Face stones on the outside, coursed; the parapet's inside, which the far side shows.
    out[facing].push(...ashlar(a0, a1, 0, par, O, { seed, course: 0.29, len: 0.55 }));
    const inner = ashlar(a0, a1, walk, par, 0, { seed: seed + 5, course: 0.225, len: 0.5 });
    for (const g of inner) g.rotateY(Math.PI).translate(a0 + a1, 0, zp);
    out[facing].push(...inner);
    // A plinth course at the foot, stepping out (the offset footing of the Wall).
    out.stone.push(box(a1 - a0, 0.16, 0.12, (a0 + a1) / 2, 0, O + 0.0, 0.8));
  } else {
    // (Rendered and limewashed, or too far out for its stones: one face, darker at its foot.)
    const wash = plain ? limewash : (g) => g;
    out[facing].push(wash(box(a1 - a0, par, 0.04, (a0 + a1) / 2, 0, O - 0.02, (x, y) => 0.8 + 0.2 * Math.min(1, y / 0.5))));
    if (plain && lod < 2) out.stone.push(box(a1 - a0, 0.22, 0.08, (a0 + a1) / 2, 0, O + 0.0, 0.75));
    out[facing].push(wash(box(a1 - a0, par - walk, 0.04, (a0 + a1) / 2, walk, zp + 0.02, 0.9)));
  }
  // The coping on the parapet.
  out.stone.push(slab(a1 - a0, 0.06, parT + 0.04, { bevel: 0.012, seed: seed + 2, wobble: 0, tone: 0, grime: 0 }).translate((a0 + a1) / 2, par, O - parT / 2));
  // The merlons: one every 0.8 m, 0.42 wide, capped.
  const n = Math.round((a1 - a0) / 0.8);
  const step = (a1 - a0) / n;
  for (let k = 0; k < n; k++) {
    const x = a0 + (k + 0.5) * step;
    if (skip && x > skip[0] && x < skip[1]) continue;
    const h = merlon - par - 0.06;
    if (lod === 2) out[facing].push(box(0.42, h, parT, x, par + 0.06, O - parT / 2, 0.95));
    else {
      out[facing].push(slab(0.42, h - 0.05, parT, { bevel: 0.01, seed: seed + 30 + k, wobble: 0.003, tone: 0.06, grime: 0 }).translate(x, par + 0.06, O - parT / 2));
      out.stone.push(slab(0.46, 0.05, parT + 0.04, { bevel: 0.01, seed: seed + 60 + k, wobble: 0.002, tone: 0, grime: 0 }).translate(x, merlon - 0.05, O - parT / 2));
    }
  }
  // The bank: turves from the yard up to the walk's inner edge, the walk's flags on top.
  const tint = (x, y) => 0.78 + 0.22 * Math.min(1, y / walk) + (lod ? 0 : 0.05 * Math.sin(x * 7.3 + y * 11));
  out.turf.push(prism(a0, a1, [[bankFoot, 0], [zi, 0], [zi, walk - 0.04], [bankFoot + 0.18, walk - 0.04]], tint));
  if (lod < 2) {
    const flags = paving(a0, a1, zi - 0.62, zp, 0.05, seed + 9, { rowW: (zp - zi + 0.62) / 2, minL: 0.4, maxL: 0.75, lod });
    for (const g of flags) g.translate(0, walk - 0.05, 0);
    out.flags.push(...flags);
  } else {
    out.flags.push(box(a1 - a0, 0.05, zp - zi + 0.62, (a0 + a1) / 2, walk - 0.05, (zi - 0.62 + zp) / 2, 0.9));
  }
}

/**
 * A square stone tower at the front-right corner (x and z from O - side to
 * O), its platform at `h`, a parapet round it and merlons up to `merlon`, a door at the
 * yard's level on its inner side, slit windows on its outer faces, a
 * platform of flags. Built on the front-right; onSide turns it to the
 * others.
 */
export function stoneTower({ lod, seed, out, side = C.tower, h = 2.6, merlon = 2.9, x0 = C.O - side, x1 = C.O, z0 = C.O - side, z1 = C.O, door = 'x', roof = false, facing = 'ashlar', plain = false }) {
  const w = x1 - x0;
  const d = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  out.core.push(box(w - 0.04, h, d - 0.04, cx, 0, cz, 0.7));
  if (lod === 0 && !plain) {
    // Ashlar on the four faces (each is seen at one view turn or another), a string course under the parapet.
    const faces = [[x0, x1, z1, 0], [z0, z1, x1, 1], [x0, x1, z0, 2], [z0, z1, x0, 3]];
    for (const [a, b, at, k] of faces) {
      const len = b - a;
      const st = ashlar(-len / 2, len / 2, 0, h, 0, { seed: seed + k * 13, course: 0.3, len: 0.5 });
      for (const g of st) {
        g.rotateY((k * Math.PI) / 2);
        if (k === 0) g.translate(cx, 0, at);
        else if (k === 1) g.translate(at, 0, cz);
        else if (k === 2) g.translate(cx, 0, at);
        else g.translate(at, 0, cz);
      }
      out[facing].push(...st);
    }
    out.stone.push(slab(w + 0.12, 0.08, d + 0.12, { bevel: 0.015, seed: seed + 3, wobble: 0, tone: 0, grime: 0 }).translate(cx, h - 0.42, cz));
  } else {
    out[facing].push(plain ? limewash(box(w, h, d, cx, 0, cz, (x, y) => 0.82 + 0.18 * Math.min(1, y / 0.5))) : box(w, h, d, cx, 0, cz, (x, y) => 0.82 + 0.18 * Math.min(1, y / 0.5)));
    if (plain && lod < 2) {
      // Dressed quoins up the outer corner, a string course under the parapet.
      for (let y = 0, k = 0; y < h - 0.3; y += 0.3, k++) {
        const lx = k % 2 ? 0.34 : 0.22;
        out.ashlar.push(box(lx, 0.28, 0.04, x1 - lx / 2, y + 0.01, z1 + 0.012, 0.95), box(0.04, 0.28, k % 2 ? 0.22 : 0.34, x1 + 0.012, y + 0.01, z1 - (k % 2 ? 0.11 : 0.17), 0.95));
      }
      out.stone.push(slab(w + 0.1, 0.07, d + 0.1, { bevel: 0.012, seed: seed + 3, wobble: 0, tone: 0, grime: 0 }).translate(cx, h - 0.4, cz));
    }
  }
  // The platform's parapet: four runs round the top, merlons on them.
  const t = 0.2;
  const ph = 0.38;
  const ring = [[x0, x1, z1 - t / 2, 'x'], [x0, x1, z0 + t / 2, 'x'], [z0 + t, z1 - t, x0 + t / 2, 'z'], [z0 + t, z1 - t, x1 - t / 2, 'z']];
  for (const [a, b, at, ax] of ring) {
    const g = ax === 'x' ? box(b - a, ph, t, (a + b) / 2, h, at, 0.92) : box(t, ph, b - a, at, h, (a + b) / 2, 0.92);
    out[facing].push(g);
    // Merlons: two on each side, at its thirds.
    if (!roof) {
      for (const f of [0.25, 0.75]) {
        const m = a + (b - a) * f;
        const mh = Math.max(0.12, merlon - h - ph);
        out[facing].push(ax === 'x' ? box(0.38, mh, t, m, h + ph, at, 0.95) : box(t, mh, 0.38, at, h + ph, m, 0.95));
      }
    }
  }
  // The platform's floor of flags inside the parapet.
  out.stone.push(box(w - 2 * t, 0.05, d - 2 * t, cx, h - 0.05, cz, 0.85));
  if (lod < 2) {
    // Slit windows on the outer faces, and the door from the yard.
    for (const [x, z, ax] of [[cx, z1 + 0.005, 'x'], [x1 + 0.005, cz, 'z']]) {
      out.dark.push(ax === 'x' ? box(0.09, 0.42, 0.02, x, 1.35, z) : box(0.02, 0.42, 0.09, x, 1.35, z));
    }
    if (door === 'x') out.dark.push(box(0.02, 1.15, 0.55, x0 - 0.005, 0, cz));
    else out.dark.push(box(0.55, 1.15, 0.02, cx, 0, z0 - 0.005));
    out.stone.push(door === 'x' ? box(0.08, 0.12, 0.75, x0 - 0.02, 1.15, cz, 0.9) : box(0.75, 0.12, 0.08, cx, 1.15, z0 - 0.02, 0.9));
  }
  if (roof) {
    // A pyramid of tiles on the platform, eaves over the parapet.
    const top = h + ph;
    const rise = 0.75;
    const o = 0.09;
    const corners = [[x0 - o, z0 - o], [x1 + o, z0 - o], [x1 + o, z1 + o], [x0 - o, z1 + o]];
    const apex = [cx, top + rise, cz];
    // Four tiled faces (masonry.js tiledRoof: courses, imbrices clipped to the hips), each a triangle.
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      const r = tiledRoof([[bx, top, bz], [ax, top, az], apex, apex], { pitch: 0.36, lod, seed: seed + 70 + i, antefix: false, imbrexR: 0.055 });
      out.tile.push(...r.tiles);
    }
    if (lod === 0) {
      // Ridges of imbrices down the hips and a finial.
      for (const [ax, az] of corners) out.tile.push(tube([[ax, top + 0.02, az], [apex[0], apex[1] + 0.02, apex[2]]], 0.045, { radial: 5, segments: 2, around: 0.2 }));
      out.clay.push(cyl(0.03, 0.06, 0.16, 8, cx, top + rise - 0.02, cz, 0.9));
    }
  }
}

/**
 * The gate on the front side: two towers (x from gateHalf to gateHalf +
 * gateTower either side, z from gateIn to O + 0.05), an arch over the
 * passage between them springing at `spring`, the walk over it with its
 * parapets inside and out, the doors (open: swung back against the
 * passage's sides; shut: across it), flags through the passage. `out` lists
 * as stoneRun's, plus doorOpen, doorShut, studs (when lod 0).
 */
export function stoneGate({ lod, seed, out, h = 2.75, merlon = 3.05, spring = 1.45, rise = 0.85, walk = 2.6, roof = false, facing = 'ashlar', plain = false, innerPar = 0.38 }) {
  const gh = C.gateHalf;
  const gw = C.gateTower;
  const z0 = C.gateIn;
  const z1 = C.O + 0.05;
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -gh - gw : gh;
    stoneTower({ lod, seed: seed + 10 + s, out, x0, x1: x0 + gw, z0, z1, h, merlon, door: 'z', roof, facing, plain });
  }
  // The arch: voussoirs round a flattened half circle over the passage (rise high, as a gate's arch
  // for carts and riders, kept low so the gate hides little of the yard); the soffit under it.
  const r = gh;
  const ky = rise / r;
  const n = lod === 0 ? 9 : lod === 1 ? 7 : 5;
  const ring = 0.3;
  const depth = z1 - z0;
  for (let k = 0; k < n; k++) {
    const a0 = Math.PI - (k / n) * Math.PI;
    const a1 = Math.PI - ((k + 1) / n) * Math.PI;
    // A wedge from radius r to r + ring between angles a0 and a1, through the gate's depth.
    const pts = [[r, a0], [r + ring, a0], [r + ring, a1], [r, a1]].map(([rr, a]) => [Math.cos(a) * rr, spring + Math.sin(a) * (rr === r ? rise : rise + ring)]);
    const sh = new Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]);
    sh.closePath();
    const g = new ExtrudeGeometry(sh, { depth: depth - 0.02, bevelEnabled: lod === 0, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
    g.deleteAttribute('uv');
    g.translate(0, 0, z0 + 0.01);
    g.computeVertexNormals();
    out.ashlar.push(tintGeometry(boxUV(g), () => 0.92 + ((k * 0.37) % 1) * 0.12));
  }
  // The spandrels and the walk over the arch: masonry from the arch's back to the walk, on both faces.
  const sp = new Shape();
  sp.moveTo(-gh, spring);
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI - (k / 12) * Math.PI;
    sp.lineTo(Math.cos(a) * (r + ring), spring + Math.sin(a) * (rise + ring));
  }
  sp.lineTo(gh, walk);
  sp.lineTo(-gh, walk);
  sp.closePath();
  const spand = new ExtrudeGeometry(sp, { depth: depth - 0.04, bevelEnabled: false, curveSegments: 6 });
  spand.deleteAttribute('uv');
  spand.translate(0, 0, z0 + 0.02);
  spand.computeVertexNormals();
  out.core.push(tintGeometry(boxUV(spand), () => 0.8));
  // The soffit: the passage's ceiling under the arch.
  const vault = new CylinderGeometry(r - 0.005, r - 0.005, depth, lod === 0 ? 16 : 8, 1, true, -Math.PI / 2, Math.PI);
  // (A half cylinder along z over the passage, seen from inside: its faces turned in.)
  vault.rotateX(Math.PI / 2);
  vault.rotateZ(Math.PI);
  vault.scale(1, ky, 1);
  vault.translate(0, spring, (z0 + z1) / 2);
  out.core.push(tintGeometry(boxUV(flipFaces(vault)), () => 0.45));
  // The walk's parapets over the gate, outside and in, crenellated outside.
  out[facing].push(box(2 * gh, 0.45, 0.2, 0, walk, z1 - 0.1, 0.92));
  out[facing].push(box(2 * gh, innerPar, 0.18, 0, walk, z0 + 0.09, 0.9));
  out.stone.push(box(2 * gh, 0.05, depth - 0.38, 0, walk - 0.05, (z0 + z1) / 2, 0.85));
  for (const f of [-0.6, 0, 0.6]) out[facing].push(box(0.4, Math.max(0.15, merlon - walk - 0.45), 0.2, f * gh, walk + 0.45, z1 - 0.1, 0.95));
  // The passage's floor: big flags, worn.
  out.flags.push(...paving(-gh, gh, z0, z1, 0.05, seed + 40, { rowW: 0.7, minL: 0.55, maxL: 0.95, lod }));
  // The doors: two leaves of planks (their tops cut to the arch), hinged at the passage's sides.
  // (Near the outer face: open, a leaf reaches back no further than the gate's inner face.)
  const zd = z1 - 0.16;
  for (const s of [-1, 1]) {
    const leaf = new Shape();
    // (Drawn for the right leaf, s = 1: from the passage's middle out to its side; the left is mirrored.)
    const N = 8;
    leaf.moveTo(0, 0.05);
    leaf.lineTo(gh - 0.02, 0.05);
    leaf.lineTo(gh - 0.02, spring);
    for (let k = 1; k <= N; k++) {
      const a = (k / N) * (Math.PI / 2);
      leaf.lineTo(Math.cos(a) * (gh - 0.02), spring + Math.sin(a) * (rise - 0.03));
    }
    leaf.closePath();
    for (const open of [false, true]) {
      const g = new ExtrudeGeometry(leaf, { depth: 0.08, bevelEnabled: false, curveSegments: 4 });
      g.deleteAttribute('uv');
      g.translate(-(gh - 0.02), 0, -0.04);
      if (s < 0) g.scale(-1, 1, 1);
      // Hinged at its outer edge (x = s * gh): open, it swings back toward the yard against the side.
      if (open) g.rotateY(-s * D(88));
      g.translate(s * (gh - 0.02), 0, zd);
      g.computeVertexNormals();
      tintGeometry(boxUV(g), (x, y) => 0.75 + 0.25 * Math.min(1, y / 0.5));
      (open ? out.doorOpen : out.doorShut).push(g);
      if (lod === 0) {
        // Iron bands across the leaf.
        for (const yy of [0.35, 1.0, 1.65]) {
          const band = box(gh - 0.08, 0.06, 0.02, -(gh - 0.02) / 2, yy, 0.045, 0.8);
          if (s < 0) band.scale(-1, 1, 1);
          if (open) band.rotateY(-s * D(88));
          band.translate(s * (gh - 0.02), 0, zd);
          (open ? out.studsOpen : out.studsShut).push(band);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Buildings inside
// ---------------------------------------------------------------------------

/**
 * A barrack block (the contubernia's rooms in a row) along z, its yard face
 * toward -x (it stands on the +x side of the yard; mirror it with
 * scale(-1, 1, 1)): x0..x1 deep, z0..z1 long, walls to `eave` on the yard
 * side and the back, a tiled gable along it, a door and a window for each
 * room. `walls` the walls' key in `out` (plaster, core).
 */
export function barrackBlock({ lod, seed, out, x0, x1, z0, z1, eave = 1.45, rooms = 4, walls = 'plaster' }) {
  const t = 0.18;
  const L = z1 - z0;
  const cz = (z0 + z1) / 2;
  // A footing course, the walls (the back one tall, under the roof's top), the dark rooms behind the doors.
  out.stone.push(box(x1 - x0 + 0.06, 0.2, L + 0.06, (x0 + x1) / 2, 0, cz, 0.75));
  const doors = [];
  const step = L / rooms;
  for (let k = 0; k < rooms; k++) doors.push(z0 + (k + 0.32) * step);
  // The front (yard) wall in pieces round the doors and windows.
  const dh = 1.1;
  const dw = 0.5;
  const front = [];
  let z = z0;
  for (const dz of doors) {
    front.push([z, dz - dw / 2, 0, eave]);
    front.push([dz - dw / 2, dz + dw / 2, dh, eave]);
    z = dz + dw / 2;
  }
  front.push([z, z1, 0, eave]);
  for (const [a, b, y0, y1] of front) if (b - a > 0.01) out[walls].push(box(t, y1 - y0, b - a, x0 + t / 2, y0, (a + b) / 2, (xx, yy) => 0.8 + 0.2 * Math.min(1, yy / 0.5)));
  // The back wall and the ends (their gables under the roof, below).
  out[walls].push(box(t, eave, L, x1 - t / 2, 0, cz, 0.85));
  for (const zz of [z0 + t / 2, z1 - t / 2]) out[walls].push(box(x1 - x0 - 2 * t, eave, t, (x0 + x1) / 2, 0, zz, 0.85));
  // The rooms seen through the doors: dark.
  out.dark.push(box(0.02, dh - 0.02, L - 2 * t, x0 + t + 0.01, 0.01, cz));
  // Door frames and the doors standing ajar; shuttered windows between.
  for (const dz of doors) {
    out.wood.push(box(t + 0.04, 0.08, dw + 0.16, x0 + t / 2, dh, dz, 0.8));
    if (lod < 2) {
      const leaf = box(0.05, dh - 0.04, dw - 0.04, 0, 0.02, -(dw - 0.04) / 2, 0.7);
      leaf.rotateY(D(-70));
      leaf.translate(x0 + 0.05, 0, dz + dw / 2 - 0.02);
      out.wood.push(leaf);
      const wz = dz + step * 0.48;
      if (wz < z1 - 0.3) {
        out.dark.push(box(0.02, 0.32, 0.36, x0 - 0.005, 0.95, wz));
        out.wood.push(box(0.05, 0.36, 0.08, x0 - 0.01, 0.93, wz - 0.22, 0.75), box(0.05, 0.36, 0.08, x0 - 0.01, 0.93, wz + 0.22, 0.75));
      }
    }
  }
  // The roof: a tiled gable along the block, its eaves low on both sides (so it hides little of
  // the yard on one side and shows its tiles over the rampart on the other), a veranda over the doors.
  const over = 0.38;
  const roof = gableRoof({ x0, x1, z0, z1, eaveY: eave, pitch: D(27), along: 'z', lod, seed: seed + 11, over, gableOver: 0.14 });
  out.tile.push(...roof.tile);
  // (Its boards and verges; not the rafters' ends, a few thousand triangles over two long blocks, in the veranda's shade.)
  out.wood.push(...roof.wood.slice(0, 6));
  for (const g of roof.wood.slice(6)) g.dispose();
  for (const zz of [z0 + t / 2, z1 - t / 2]) {
    const g = new BoxGeometry(x1 - x0 - 0.02, 1, t, 2, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = Math.abs(p.getX(i)) / ((x1 - x0) / 2);
      p.setY(i, p.getY(i) > 0 ? eave + (roof.ridgeY - eave) * (1 - u) : eave);
    }
    g.computeVertexNormals();
    g.translate((x0 + x1) / 2, 0, zz);
    out[walls].push(tintGeometry(boxUV(g), () => 0.85));
  }
  // The eave's beam on posts: a veranda over the doors.
  if (lod < 2) {
    const px = x0 - over + 0.1;
    out.wood.push(beam([px, eave - 0.06, z0 - 0.05], [px, eave - 0.06, z1 + 0.05], 0.1, seed + 3, lod));
    const np = Math.max(2, Math.round(L / 1.6) + 1);
    for (let k = 0; k < np; k++) out.wood.push(box(0.09, eave - 0.1, 0.09, px, 0, z0 + (k * L) / (np - 1), 0.8));
  }
}

/**
 * A soldiers' leather tent (papilio, after the panels of calf hide found at
 * Vindolanda and the tents on Trajan's Column): a ridge tent L long (along
 * z), w wide, h to its ridge, with low side walls, its door flaps at +z
 * (`open`: one tied back). Returns { leather, wood, rope, dark }.
 */
export function tent({ L = 1.5, w = 1.25, h = 1.15, wall = 0.32, lod = 0, open = true, seed = 1 }) {
  const out = { leather: [], wood: [], rope: [], dark: [] };
  const hw = w / 2;
  const sec = [[-hw, 0], [hw, 0], [hw, wall], [0, h], [-hw, wall]];
  // Its body: the cross-section run along z (prism along x, turned).
  const body = prism(-L / 2, L / 2, sec.map(([x, y]) => [x, y]), (x, y) => 0.82 + 0.18 * Math.min(1, y / h));
  body.rotateY(Math.PI / 2);
  // (Sag between the poles: the ridge dips a little in the middle.)
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > wall + 0.01) p.setY(i, y - 0.05 * Math.cos((p.getZ(i) / L) * Math.PI) * (y / h));
  }
  body.computeVertexNormals();
  out.leather.push(body);
  if (lod < 2) {
    // The seams of the hide panels: darker stripes across the roof.
    const rnd = artRng(seed);
    // The door: a dark triangle at the front, a flap tied back.
    if (open) {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute([-hw * 0.55, 0.01, L / 2 + 0.005, hw * 0.1, 0.01, L / 2 + 0.005, -hw * 0.05, h * 0.82, L / 2 + 0.005], 3));
      g.computeVertexNormals();
      out.dark.push(tintGeometry(boxUV(g)));
      const flap = new BufferGeometry();
      flap.setAttribute('position', new Float32BufferAttribute([hw * 0.1, 0.02, L / 2, hw * 0.55, 0.05, L / 2 + 0.18, -hw * 0.05, h * 0.82, L / 2], 3));
      flap.computeVertexNormals();
      out.leather.push(tintGeometry(boxUV(flap), () => 0.8));
    }
    // Poles at the ends, guy ropes to pegs.
    for (const s of [-1, 1]) {
      out.wood.push(cyl(0.02, 0.022, h + 0.12, 5, 0, 0, s * (L / 2 + 0.02), 0.8));
      if (lod === 0) {
        out.rope.push(tube([[0, h + 0.05, s * (L / 2 + 0.02)], [0, 0.04, s * (L / 2 + 0.55)]], 0.008, { radial: 3, segments: 2, around: 0.1 }));
        for (const sx of [-1, 1]) out.rope.push(tube([[sx * hw, wall, s * L * 0.3], [sx * (hw + 0.35), 0.03, s * L * 0.3 + rnd() * 0.05]], 0.007, { radial: 3, segments: 2, around: 0.1 }));
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The standards
// ---------------------------------------------------------------------------

/** A pole for a standard, `h` tall, its foot at (x, 0, z): wood with a bronze shoe and a hand-grip. */
function standardPole(x, z, h, lod, out) {
  out.wood.push(cyl(0.022, 0.026, h, lod ? 5 : 8, x, 0.02, z, 0.8));
  out.gilt.push(cyl(0.03, 0.018, 0.12, lod ? 5 : 8, x, 0.0, z, 0.9));
  if (lod === 0) out.gilt.push(cyl(0.034, 0.034, 0.08, 8, x, h * 0.42, z, 0.9));
}

/**
 * The eagle (aquila), a legion's standard: a gilt eagle with its wings
 * raised, on a thunderbolt, on a pole `h` tall at (x, z), facing +z.
 */
export function aquila(x, z, h, lod, out) {
  standardPole(x, z, h, lod, out);
  const y = h + 0.02;
  // The thunderbolt it grips, a small plinth.
  out.gilt.push(box(0.16, 0.035, 0.05, x, y, z, 0.9));
  if (lod < 2) for (const s of [-1, 1]) out.gilt.push(staff([x, y + 0.02, z], [x + s * 0.12, y - 0.04, z + 0.02], 0.01, 4));
  // The body, the head, the tail.
  const body = new SphereGeometry(0.06, lod ? 6 : 10, lod ? 5 : 8);
  body.scale(0.85, 1.35, 1);
  body.translate(x, y + 0.11, z);
  out.gilt.push(tintGeometry(boxUV(body), () => 0.95));
  const head = new SphereGeometry(0.035, lod ? 5 : 8, lod ? 4 : 6);
  head.translate(x, y + 0.21, z + 0.035);
  out.gilt.push(tintGeometry(boxUV(head), () => 1));
  if (lod < 2) {
    const beak = new ConeGeometry(0.014, 0.05, 4);
    beak.rotateX(Math.PI / 2 + 0.5);
    beak.translate(x, y + 0.2, z + 0.075);
    out.gilt.push(tintGeometry(boxUV(beak), () => 0.85));
  }
  // The wings: raised, spread, their tips curled in; each a fan of three feathered plates.
  for (const s of [-1, 1]) {
    const pts = [[0, 0], [0.06, 0.05], [0.13, 0.17], [0.16, 0.27], [0.1, 0.24], [0.09, 0.15], [0.05, 0.12], [0.03, 0.08], [0, 0.06]];
    const sh = new Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]);
    sh.closePath();
    const g = new ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false });
    g.deleteAttribute('uv');
    if (s < 0) g.scale(-1, 1, 1);
    // (Swept back a little.)
    g.rotateY(-s * 0.35);
    g.translate(x + s * 0.03, y + 0.1, z - 0.01);
    g.computeVertexNormals();
    out.gilt.push(tintGeometry(boxUV(g), () => 0.9));
  }
  const tail = box(0.06, 0.012, 0.09, x, y + 0.04, z - 0.07, 0.85);
  out.gilt.push(tail);
  // The wreath round the pole under it.
  if (lod === 0) {
    const w = new TorusGeometry(0.07, 0.014, 5, 14);
    w.rotateX(Math.PI / 2);
    w.translate(x, y - 0.16, z);
    out.gilt.push(tintGeometry(boxUV(w), () => 0.85));
  }
}

/**
 * A century's or a cohort's standard (signum): a spear point or an open
 * hand (manus) at the top, a cross-bar with ribbons, a column of silvered
 * discs (phalerae), a crescent; on a pole `h` tall at (x, z).
 */
export function signum(x, z, h, lod, out, { hand = true, discs = 5 } = {}) {
  standardPole(x, z, h, lod, out);
  const top = h + 0.02;
  if (hand) {
    // The hand: a flat palm and fingers.
    out.gilt.push(box(0.07, 0.09, 0.02, x, top + 0.04, z, 0.95));
    if (lod < 2) for (let k = 0; k < 4; k++) out.gilt.push(box(0.014, 0.06, 0.016, x - 0.027 + k * 0.018, top + 0.13, z, 0.95));
    out.gilt.push(box(0.05, 0.04, 0.02, x, top, z, 0.9));
  } else {
    const pt = new ConeGeometry(0.03, 0.18, 4);
    pt.translate(x, top + 0.09, z);
    out.iron.push(tintGeometry(boxUV(pt), () => 0.9));
  }
  // The cross-bar and its ribbons.
  const by = top - 0.1;
  out.gilt.push(box(0.3, 0.02, 0.02, x, by, z, 0.9));
  if (lod < 2) {
    for (const s of [-1, 1]) {
      out.cloth.push(tintGeometry(box(0.025, 0.28, 0.006, x + s * 0.14, by - 0.28, z), () => lin(0xb83a2a)));
      if (lod === 0) out.gilt.push(cyl(0.012, 0.004, 0.04, 5, x + s * 0.14, by - 0.32, z, 0.9));
    }
  }
  // The discs, and the crescent under them.
  for (let k = 0; k < discs; k++) {
    const d = new CylinderGeometry(0.06, 0.06, 0.018, lod ? 8 : 14, 1);
    d.rotateX(Math.PI / 2);
    d.translate(x, by - 0.12 - k * 0.15, z + 0.03);
    out.silver.push(tintGeometry(boxUV(d), () => 0.95));
    if (lod === 0) {
      const boss = new SphereGeometry(0.022, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      boss.rotateX(Math.PI / 2);
      boss.translate(x, by - 0.12 - k * 0.15, z + 0.04);
      out.gilt.push(tintGeometry(boxUV(boss), () => 1));
    }
  }
  if (lod < 2) {
    const moon = new TorusGeometry(0.06, 0.014, 4, 10, Math.PI);
    moon.rotateZ(Math.PI);
    moon.translate(x, by - 0.16 - discs * 0.15, z + 0.03);
    out.silver.push(tintGeometry(boxUV(moon), () => 0.95));
  }
}

/**
 * A flag (vexillum): a square of cloth hung from a cross-bar on a pole
 * `h` tall at (x, z), fringed, in `colour` (linear RGB) with a gold border.
 */
export function vexillum(x, z, h, lod, out, colour, { w = 0.46, hc = 0.5 } = {}) {
  standardPole(x, z, h, lod, out);
  const top = h + 0.02;
  const pt = new ConeGeometry(0.025, 0.14, 4);
  pt.translate(x, top + 0.07, z);
  out.iron.push(tintGeometry(boxUV(pt), () => 0.9));
  const by = top - 0.06;
  out.wood.push(box(w + 0.1, 0.025, 0.025, x, by, z, 0.8));
  // The cloth: a little sagging sheet, its border lighter.
  const seg = lod === 0 ? 8 : 3;
  const g = new BoxGeometry(w, hc, 0.006, seg, seg, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / w + 0.5;
    const v = 0.5 - p.getY(i) / hc;
    p.setZ(i, p.getZ(i) + Math.sin(u * Math.PI * 2 + v) * 0.02 * v);
  }
  g.translate(x, by - hc / 2 - 0.02, z + 0.02);
  g.computeVertexNormals();
  const gold = lin(0xd8a84a);
  out.cloth.push(tintGeometry(boxUV(g), (gx, gy) => {
    const u = Math.abs(gx - x) / (w / 2);
    const v = Math.abs(gy - (by - hc / 2 - 0.02)) / (hc / 2);
    return u > 0.86 || v > 0.88 ? gold : colour;
  }));
  if (lod === 0) {
    // The fringe along its foot, two cords from the bar's ends.
    for (let k = 0; k < 9; k++) out.cloth.push(tintGeometry(box(0.018, 0.06, 0.006, x - w / 2 + (k + 0.5) * (w / 9), by - hc - 0.08, z + 0.02), () => gold));
    for (const s of [-1, 1]) out.rope.push(tube([[x + s * (w / 2 + 0.04), by, z], [x + s * (w / 2 + 0.05), by - 0.18, z + 0.01], [x + s * (w / 2 + 0.03), by - 0.3, z]], 0.006, { radial: 3, segments: 4, around: 0.1 }));
  }
}

/**
 * The cavalry's dragon (draco), as Arrian describes it and the bronze head
 * from Niederbieber shows: a gaping bronze head on a pole, a tube of dyed
 * cloth behind it that filled with wind at the gallop; at rest it hangs.
 */
export function draco(x, z, h, lod, out, colour) {
  standardPole(x, z, h, lod, out);
  const y = h + 0.04;
  // The head: a snout open on its teeth, crested, facing +z.
  const head = revolve(profileOf([[0, -0.16], [0.03, -0.14], [0.055, -0.06], [0.065, 0.02], [0.055, 0.07], [0.0, 0.08]]), { segments: lod ? 6 : 10, metres: 0.3 });
  head.rotateX(Math.PI / 2);
  head.scale(0.8, 1, 1);
  head.translate(x, y, z + 0.12);
  out.bronze.push(head);
  if (lod < 2) {
    const jaw = box(0.08, 0.02, 0.14, x, y - 0.05, z + 0.2, 0.85);
    jaw.rotateX(0.25);
    out.bronze.push(jaw);
    out.gilt.push(box(0.014, 0.05, 0.16, x, y + 0.05, z + 0.08, 0.9));
  }
  // The windsock: hanging down from the head's back in a slack curve.
  const pts = [[x, y, z + 0.02], [x, y - 0.08, z - 0.12], [x + 0.02, y - 0.3, z - 0.18], [x + 0.01, y - 0.55, z - 0.12], [x - 0.01, y - 0.72, z - 0.08]];
  const sock = tube(pts, 0.05, { radial: lod ? 5 : 8, segments: lod ? 5 : 12, around: 0.2 });
  const r0 = sock.attributes.position;
  // (Tapering toward its tail.)
  const col = sock.attributes.color;
  for (let i = 0; i < r0.count; i++) {
    const t = Math.max(0, Math.min(1, (y - r0.getY(i)) / 0.75));
    const c = t > 0.66 ? lin(0xd8a84a) : colour;
    col.setXYZ(i, c[0], c[1], c[2]);
  }
  out.cloth.push(sock);
}

/** The emperor's portrait (imago) on its pole: a bust in a gilt roundel. */
export function imago(x, z, h, lod, out) {
  standardPole(x, z, h, lod, out);
  const y = h - 0.05;
  const d = new CylinderGeometry(0.11, 0.11, 0.025, lod ? 10 : 18, 1);
  d.rotateX(Math.PI / 2);
  d.translate(x, y, z + 0.03);
  out.gilt.push(tintGeometry(boxUV(d), () => 0.9));
  if (lod < 2) {
    const bust = revolve(profileOf([[0, 0], [0.07, 0], [0.06, 0.04], [0.03, 0.07], [0.035, 0.11], [0.03, 0.14], [0, 0.15]]), { segments: 8, metres: 0.3 });
    bust.scale(1, 1, 0.5);
    bust.translate(x, y - 0.08, z + 0.05);
    out.gilt.push(bust);
  }
}

/** A stone base with sockets for the standards along x from xa to xb at z (their sockets dark: the shrine's rack). */
export function standardBase(xa, xb, z, lod, out, n) {
  out.stone.push(slab(xb - xa + 0.3, 0.16, 0.3, { bevel: 0.015, seed: 7, wobble: 0.002, tone: 0.03, grime: 0.2 }).translate((xa + xb) / 2, 0, z));
  if (lod < 2) for (let k = 0; k < n; k++) out.dark.push(cyl(0.035, 0.035, 0.005, 8, xa + (k * (xb - xa)) / Math.max(1, n - 1), 0.16, z));
}

// ---------------------------------------------------------------------------
// Fittings
// ---------------------------------------------------------------------------

/** A domed bread oven of clay on a stone base (the forts' ovens stood in the lee of the rampart), its mouth toward +z. */
export function oven(x, z, lod, out, { r = 0.5 } = {}) {
  out.stone.push(slab(2 * r + 0.2, 0.3, 2 * r + 0.2, { bevel: 0.02, seed: 3, wobble: 0.004, tone: 0.05, grime: 0.5 }).translate(x, 0, z));
  const dome = new SphereGeometry(r, lod ? 8 : 14, lod ? 5 : 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 0.85, 1);
  dome.translate(x, 0.3, z);
  out.clay.push(tintGeometry(boxUV(dome), (gx, gy) => 0.7 + 0.3 * Math.min(1, (gy - 0.3) / 0.3)));
  if (lod < 2) out.dark.push(box(0.26, 0.22, 0.02, x, 0.3, z + r * 0.98));
}

/** A tank of water: stone slabs round a basin (the forts' tanks were fed by aqueducts or rain), w x d at (x, z), `rim` high. */
export function tank(x, z, w, d, rim, lod, out, seed = 1) {
  const t = 0.12;
  for (const s of [-1, 1]) {
    out.stone.push(slab(w, rim, t, { bevel: 0.015, seed: seed + s, wobble: 0.003, tone: 0.05, grime: 0.4 }).translate(x, 0, z + s * (d / 2 - t / 2)));
    out.stone.push(slab(t, rim, d - 2 * t, { bevel: 0.015, seed: seed + 3 + s, wobble: 0.003, tone: 0.05, grime: 0.4 }).translate(x + s * (w / 2 - t / 2), 0, z));
  }
  out.stone.push(box(w - 2 * t, 0.05, d - 2 * t, x, 0, z, 0.6));
  out.water.push(box(w - 2 * t, 0.02, d - 2 * t, x, rim - 0.1, z));
}

export { lantern, lanternPane };

/**
 * A soldier standing guard, as the models' people are (figure.js): a tunic
 * in `cloth`, a bronze helmet for his hair, a spear in his right hand, a
 * shield on his left arm; at (x, y, z) facing ry. Adds to TaggedParts `p`
 * under `name` in state `when`.
 */
export function sentry(p, mats, name, x, y, z, ry, when, { cloth = 0xa8322b, shield = null } = {}) {
  // (The figure's hair cap is a helmet here.)
  const parts = figureParts({ cloth, cloth2: null, skin: 0xa87a58 }, x, y, z, ry, 0.95).map((f) => (f.material.name.startsWith('hair-') ? { g: f.g, material: mats.bronze } : f));
  // The spear upright beside him, a shield at his side.
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const at = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  const [sx, sz] = at(0.26, 0.08);
  parts.push({ g: staff([sx, y, sz], [sx, y + 2.0, sz], 0.014, 5), material: mats.wood });
  const tip = new ConeGeometry(0.022, 0.16, 4);
  tip.translate(sx, y + 2.08, sz);
  parts.push({ g: tintGeometry(boxUV(tip)), material: mats.iron });
  if (shield) {
    const [hx, hz] = at(-0.26, 0.12);
    const g = new CylinderGeometry(0.55, 0.55, 0.95, 6, 1, true, -0.5, 1.0);
    g.translate(0, 0, -0.55);
    g.scale(0.62, 1, 0.62);
    g.rotateY(ry - Math.PI / 2 + 0.2);
    g.translate(hx, y + 0.62, hz);
    parts.push({ g: tintGeometry(boxUV(g), () => shield), material: mats.paint });
  }
  people(p, mats, name, parts, when);
}

/**
 * People (figure.js figureParts, and what they hold) added to TaggedParts
 * `p` in state `when`, one part a material: every figure's tunic in the one
 * dyed cloth, its colour carried by its vertices, so a crowd of men in
 * three colours is one draw call for their clothes, not three.
 */
export function people(p, mats, name, parts, when) {
  const by = new Map();
  for (const f of parts) {
    let { g, material: m } = f;
    if (m.name.startsWith('cloth-') && m !== mats.cloth) {
      // (cloth-<hex>: the colour from its name, times the figure's own shading in its vertices.)
      const rgb = lin(Number.parseInt(m.name.slice(6), 16));
      const col = g.attributes.color;
      for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * rgb[0], col.getY(i) * rgb[1], col.getZ(i) * rgb[2]);
      m = mats.cloth;
    }
    if (!by.has(m)) by.set(m, []);
    by.get(m).push(g);
  }
  for (const [m, list] of by) p.add(`${name}-${m.name}`, m, list, { when });
}

/** The look's double-sided cloth for things seen from both sides (a flag, a tent's flap). */
export function clothBothSides() {
  return material('cloth-dyed-2s', { surface: 'wool', vertexColors: true, snow: 0.7, side: DoubleSide });
}

// ---------------------------------------------------------------------------
// Inscriptions
// ---------------------------------------------------------------------------

/** The letters the forts' plaques need besides the forum's (masonry.js GLYPHS): N and D. */
const MORE_GLYPHS = Object.freeze({
  N: { w: 0.7, s: [[0, 0, 0, 1], [0, 1, 0.7, 0], [0.7, 0, 0.7, 1]] },
  D: { w: 0.66, s: [[0, 0, 0, 1], [0, 1, 0.34, 1], [0.34, 1, 0.58, 0.84], [0.58, 0.84, 0.66, 0.5], [0.66, 0.5, 0.58, 0.16], [0.58, 0.16, 0.34, 0], [0.34, 0, 0, 0]] },
});
const ALL_GLYPHS = { ...GLYPHS, ...MORE_GLYPHS };

/** `text` in cut strokes centred on x = 0, its foot at y, its face at z, h tall (masonry.js inscription, with N and D). */
export function inscribe(text, y, z, h) {
  const sw = h * 0.13;
  const gap = h * 0.28;
  const width = [...text].reduce((a, ch) => a + ALL_GLYPHS[ch].w * h + gap, -gap);
  let x = -width / 2;
  const out = [];
  for (const ch of text) {
    const g = ALL_GLYPHS[ch];
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

/** The yard's gravel over x0..x1, z0..z1 (a thin sheet just over the ground, lighter where it is trodden). */
export function gravel(x0, x1, z0, z1, out) {
  out.gravel.push(box(x1 - x0, C.floorY, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, (x, y, z) => 0.85 + 0.15 * Math.cos(x * 0.6) * Math.cos(z * 0.5)));
}

export { D };

// ---------------------------------------------------------------------------
// Putting a fort together
// ---------------------------------------------------------------------------

/** A tank's water, kept by name so the game can freeze it in a hard frost (models/militaryModels.js). */
export const TANK_WATER = 'tank-water';

/** The lists a fort is built into, by material key (and the gate's doors by state). */
export function fortBag() {
  const keys = ['gravel', 'flags', 'ashlar', 'core', 'stone', 'turf', 'tile', 'clay', 'thatch', 'wood', 'plaster', 'red', 'dark', 'iron', 'bronze', 'marble',
    'letters', 'water', 'leather', 'rope', 'straw', 'hay', 'paint', 'cloth', 'earth', 'doorOpen', 'doorShut', 'studsOpen', 'studsShut'];
  return Object.fromEntries(keys.map((k) => [k, []]));
}

/** Push every list of bag `from` into bag `to`, turned by `fn` (onSide, mirrorX) first. */
export function pour(from, to, fn = (l) => l) {
  for (const [key, list] of Object.entries(from)) if (list.length) to[key].push(...fn(list));
}

/**
 * A fort's parts by material and state (TaggedParts): the bag's lists, the
 * standards (`std`, shown 'home': out with the men when deployed), the gate's
 * doors (open while 'staffed', shut when 'shut'), and lanterns at `lamps`
 * ([x, y, z], hung from the gate's passage walls, x toward the nearer one),
 * lit while 'staffed'. Returns { p, mats } for the fort to add its own.
 */
export function assemble(name, out, std, lod, lamps, { facing = 'ashlar' } = {}) {
  const mats = castraMaterials();
  // Far out, small fittings are under a pixel and each a draw call for every fort in view.
  if (lod === 2) {
    out.iron = out.bronze = out.letters = out.rope = [];
    std.rope = [];
  }
  // Fewer materials, fewer draw calls (each part is one for every fort in view, and one more in the
  // sun's shadow pass if it casts): the ovens' clay is the roofs' terracotta, the plaques are stone;
  // from the middle zooms out the core behind the facing is the facing's.
  out.tile.push(...out.clay.splice(0));
  out.stone.push(...out.marble.splice(0));
  if (lod > 0) out[facing].push(...out.core.splice(0));
  // The standards: their metal all gilt from the middle zooms out (the discs a speck), the cords cloth.
  const sm = { wood: std.wood || [], gilt: [...(std.gilt || []), ...(std.bronze || [])], silver: [...(std.silver || []), ...(std.iron || [])], cloth: [...(std.cloth || []), ...(std.rope || [])] };
  if (lod > 0) sm.gilt.push(...sm.silver.splice(0));
  const p = new TaggedParts(name);
  const small = { cast: false };
  p.add('yard', mats.gravel, out.gravel, small);
  p.add('ground', mats.earth, out.earth, small);
  p.add('ashlar', mats.ashlar, out.ashlar);
  p.add('core', mats.core, out.core);
  p.add('stone', mats.stone, out.stone);
  p.add('flags', mats.flags, out.flags, small);
  p.add('bank', mats.turf, out.turf);
  p.add('roof', mats.tile, out.tile);
  p.add('thatch', mats.thatch, out.thatch);
  p.add('wood', mats.wood, out.wood);
  p.add('walls', mats.plaster, out.plaster);
  p.add('dado', mats.red, out.red, small);
  p.add('inside', mats.dark, out.dark, small);
  p.add('iron', mats.iron, out.iron, small);
  p.add('bronze', mats.bronze, out.bronze, small);
  p.add('letters', mats.letters, out.letters, small);
  p.add('leather', mats.leather, out.leather);
  p.add('rope', mats.rope, out.rope, small);
  p.add('straw', mats.straw, out.straw);
  p.add('hay', mats.hay, out.hay);
  p.add('paint', mats.paint, out.paint, small);
  p.add('cloth', mats.cloth, out.cloth, small);
  p.add(TANK_WATER, waterMaterial(), out.water, small);
  p.add('doors', mats.wood, out.doorOpen, { when: 'staffed' });
  p.add('doors', mats.wood, out.doorShut, { when: 'shut' });
  p.add('bands', mats.iron, out.studsOpen, { when: 'staffed', cast: false });
  p.add('bands', mats.iron, out.studsShut, { when: 'shut', cast: false });
  // The standards: at home (manned or not), gone out with the men when deployed. Only their poles
  // and flags cast a shadow close up.
  p.add('std-wood', mats.wood, sm.wood, { when: 'home', cast: lod === 0 });
  p.add('std-gilt', mats.gilt, sm.gilt, { when: 'home', cast: false });
  p.add('std-silver', mats.silver, sm.silver, { when: 'home', cast: false });
  p.add('std-cloth', mats.cloth, sm.cloth, { when: 'home', cast: lod === 0 });
  // The lanterns at the gate, hung on brackets from the passage's walls: lit while the fort is manned.
  if (lod < 2) {
    for (const [lx, ly, lz] of lamps) {
      const l = lantern(lx, ly, lz, lod);
      const wall = Math.sign(lx) * C.gateHalf;
      p.add('bronze', mats.bronze, l.bronze);
      p.add('iron', mats.iron, [box(Math.abs(wall - lx) + 0.02, 0.025, 0.025, (wall + lx) / 2, ly + 0.36, lz, 0.8), box(0.025, 0.36, 0.025, lx, ly + 0.3, lz, 0.8)]);
      p.add('lamp', lanternPane(), [l.pane], { when: 'staffed', cast: false });
      p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
    }
  }
  return { p, mats };
}
