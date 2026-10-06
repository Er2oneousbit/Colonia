/**
 * models/engineer.js
 * ----------------------------------------------------------------------------
 * The engineer's post of the 3D look: a builders' yard of the fabri on one
 * 4 m tile, from what is known of Roman builders and their tools rather
 * than from the 2D sprite:
 *
 *   - The fabri tignarii, the builders in timber and stone, were a town's
 *     biggest guild: Ostia's collegium fabrum tignariorum counted some
 *     three hundred and fifty members and had its own seat. In the
 *     provinces the fabri were also the town's fire brigade (Pliny's
 *     letter to Trajan about the fire at Nicomedia).
 *   - The surveyor's groma: a staff with an offset bracket carrying a
 *     cross whose four arms each hang a plumb line, for setting out right
 *     angles; one was found in a workshop at Pompeii, and the tombstone of
 *     the surveyor Lucius Aebutius Faustus at Ivrea shows it. The builders'
 *     other tools, from Vitruvius, finds and the reliefs on their
 *     tombstones: the set square (norma), the A-frame level with its plumb
 *     line (libella), the plumb bob, the compass, the frame saw, the adze,
 *     the mallet and chisels, the mortar hoe.
 *   - Their machines (Vitruvius, book X): the simplest hoist, two timbers
 *     lashed together at the top and spread at the foot (shear legs), held
 *     by ropes, a pulley block at the top, the rope run down to a windlass
 *     between the legs; the stone lifted by iron tongs (forceps) gripping
 *     holes cut in its sides, as many ashlar blocks still show.
 *   - Their stock: ashlar of tufa and travertine, square bricks (bessales)
 *     stacked in crossed courses, timber, lime and pozzolana for concrete
 *     (Vitruvius, book II).
 *   - Their own workshop in opus craticium, the timber frame filled with
 *     rubble and plastered that Herculaneum's Casa a Graticcio keeps, and
 *     that Vitruvius warns burns like a torch.
 *
 * So, on a 4 m tile of beaten earth: at the back-left an open-fronted
 * workshop in opus craticium under a lean-to of tiles, a bench inside, a
 * sign over its front (COLLEGIVM FABRVM), the tool rack on its side wall;
 * at the back-right the shear legs over an ashlar block; in front, the
 * groma standing by the street as the yard's sign, squared timbers on
 * bearers, a mortar trough and a heap of pozzolana, a stack of bricks and
 * a stack of ashlar.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: a man at the windlass and the block hoisted, the
 *           surveyor at the groma, the saw and mallet out on the bench
 *   'shut'  no staff: the block let down onto rollers, the saw and the
 *           mallet back on the rack, nobody, the lantern out
 *
 * Metres, the tile's middle at the origin, y up, the front (the street)
 * toward +z, as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, TorusGeometry, IcosahedronGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { material } from '../materials.js';
import { artRng } from '../texgen.js';
import { slab, lantern, lanternPane, inscription, TaggedParts } from './masonry.js';
import { leanTo, beam, lin } from './rural.js';
import { figureParts } from './figure.js';

/** The yard's measures (metres): the tests, the lab and the game read them. */
export const ENGINEER = Object.freeze({
  half: 2,
  floorY: 0.04, // the yard's beaten earth
  // The workshop's outer faces (back-left), its walls' thickness, its lean-to roof's top and eave.
  shed: Object.freeze({ x0: -1.85, x1: 0.45, z0: -1.9, z1: -0.15, t: 0.22, topY: 3.0, eaveY: 2.45 }),
  // The shear legs: their feet and where they meet.
  feet: Object.freeze([Object.freeze([0.92, -1.8]), Object.freeze([1.8, -1.8])]),
  apex: Object.freeze([1.36, 3.42, -0.66]),
  /** The groma's staff (x, z) and its height. */
  groma: Object.freeze([-1.18, 1.42, 1.74]),
  /** The lantern at the workshop's front corner (x, y, z): the game's night lights it while staffed (models.js modelLamps). */
  lamp: Object.freeze([0.33, 1.93, 0.07]),
});

const E = ENGINEER;

/** A box w x h x d, its foot at (x, y, z): UVs in metres, a vertex colour of `k`. */
function box(w, h, d, x, y, z, k = 1) {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return tintGeometry(boxUV(g), () => k);
}

/** A round pole from a to b ([x, y, z]), radius r: a trimmed tree, its bark taken off. */
function pole(a, b, r, lod, seed = 1) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const g = new CylinderGeometry(r * 0.85, r, len, lod === 0 ? 10 : lod === 1 ? 6 : 4, lod === 0 ? 3 : 1);
  // (Not quite straight: a pole is a young tree.)
  if (lod === 0) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / len + 0.5;
      p.setX(i, p.getX(i) + Math.sin(t * Math.PI) * 0.025 * Math.sin(seed));
    }
    g.computeVertexNormals();
  }
  g.translate(0, len / 2, 0);
  g.rotateX(Math.acos(Math.max(-1, Math.min(1, dy / len))));
  g.rotateY(Math.atan2(dx, dz));
  g.translate(a[0], a[1], a[2]);
  return tintGeometry(boxUV(g), (x, y) => 0.75 + 0.25 * Math.min(1, y / 0.4));
}

/**
 * A wall of opus craticium from (x0, z0) to (x1, z1) on the ground plan, t
 * thick, its top from yA at the first end to yB at the second: a plastered
 * infill on a rubble footing, the timber frame (sill, posts, a rail, braces,
 * the head) proud of the face that `face` names (+1: the side to the left of
 * the run, as +z is to the left of a run along +x).
 */
function craticium(x0, z0, x1, z1, t, yA, yB, face, lod, seed, out) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const yaw = Math.atan2(z1 - z0, x1 - x0);
  const foot = 0.28;
  const place = (g) => {
    g.rotateY(-yaw);
    g.translate(x0, 0, z0);
    return g;
  };
  // The footing of rubble, then the panel's plaster, its top sloping from yA to yB.
  out.rubble.push(place(boxUV(slab(len, foot, t + 0.06, { bevel: 0.02, seed, wobble: 0.004, tone: 0.05, grime: 0.5 }).translate(len / 2, 0, 0))));
  const panel = new BoxGeometry(len, 1, t, 2, 1, 1);
  const pos = panel.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / len + 0.5;
    const top = pos.getY(i) > 0;
    pos.setY(i, top ? yA + (yB - yA) * u : foot);
    pos.setX(i, u * len);
  }
  panel.computeVertexNormals();
  out.plaster.push(place(tintGeometry(boxUV(panel), (x, y) => 0.82 + 0.18 * Math.min(1, (y - foot) / 0.6))));
  if (lod === 2) return;
  // The frame on both faces (every face is seen at one view turn or another): posts every 0.8 m or
  // so, the sill, a rail at 1.25 m, braces across the end bays, the head under the roof. Each a plain
  // squared timber nearly flush with the plaster, as the Herculaneum house shows it (a bevel would
  // cost a hundred triangles a timber and show under a pixel).
  const w = 0.1;
  const n = Math.max(1, Math.round(len / 0.8));
  const yAt = (u) => yA + (yB - yA) * (u / len);
  const bay = len / n;
  for (const s of [-1, 1]) {
    const z = s * (t / 2 - w / 2 + 0.02);
    const timber = (a, b) => place(beam([a[0], a[1], z], [b[0], b[1], z], w, seed + a[0] * 13 + a[1] * 7, 1));
    out.frame.push(timber([0, foot], [len, foot]));
    for (let k = 0; k <= n; k++) {
      const u = Math.min(len - w / 2, Math.max(w / 2, (k * len) / n));
      out.frame.push(timber([u, foot], [u, yAt(u) - 0.02]));
    }
    out.frame.push(timber([0, 1.25], [len, 1.25]));
    out.frame.push(timber([0, yA - 0.06], [len, yB - 0.06]));
    // Braces across the first and the last bay, as the Herculaneum house has them.
    out.frame.push(timber([w / 2, foot + 0.05], [bay - w / 2, 1.2]));
    if (n > 1) out.frame.push(timber([len - w / 2, foot + 0.05], [len - bay + w / 2, 1.2]));
  }
}

/** The workshop: its three walls, the open front's beam, the lean-to roof, the bench, the sign, poles and rope inside. */
function workshop(lod, seed, out) {
  const { x0, x1, z0, z1, t, topY, eaveY } = E.shed;
  // The back wall, its face out the back (-z); the ends, faced outward (-x, +x), their tops falling to the front.
  craticium(x0, z0 + t / 2, x1, z0 + t / 2, t, topY - 0.02, topY - 0.02, -1, lod, seed + 1, out);
  craticium(x0 + t / 2, z1, x0 + t / 2, z0 + t, t, eaveY - 0.06, topY - 0.06, -1, lod, seed + 2, out);
  craticium(x1 - t / 2, z0 + t, x1 - t / 2, z1, t, topY - 0.06, eaveY - 0.06, -1, lod, seed + 3, out);
  // The beam over the open front, resting on the end walls; the roof leans on the back wall down to it.
  out.wood.push(slab(x1 - x0, 0.18, 0.16, { bevel: 0.012, seed: seed + 5, wobble: 0.002, tone: 0.06, grime: 0 }).translate((x0 + x1) / 2, eaveY - 0.2, z1 - 0.08));
  const roof = leanTo({ L: x1 - x0 + 0.2, span: z1 - z0, topY, eaveY, lod, seed: seed + 6, over: 0.24 });
  for (const g of roof.tile) out.tile.push(g.translate((x0 + x1) / 2, 0, z0));
  for (const g of roof.wood) out.wood.push(g.translate((x0 + x1) / 2, 0, z0));
  // The floor inside: beaten earth, darker for the shade and the sawdust.
  out.dark.push(box(x1 - x0 - 2 * t, 0.012, z1 - z0 - t, (x0 + x1) / 2, E.floorY, (z0 + t + z1) / 2, 0.55));
  // The bench along the back wall: a thick top on four legs, a plank on it being worked.
  const bx = -0.82;
  const bz = z0 + t + 0.28;
  const bY = 0.8;
  out.wood.push(slab(1.45, 0.08, 0.42, { bevel: 0.012, seed: seed + 10, wobble: 0.002, tone: 0.06, grime: 0 }).translate(bx, bY - 0.08, bz));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) out.wood.push(box(0.08, bY - 0.08 - E.floorY, 0.08, bx + sx * 0.62, E.floorY, bz + sz * 0.15, 0.85));
  if (lod < 2) {
    out.wood.push(slab(0.95, 0.04, 0.22, { bevel: 0.006, seed: seed + 11, wobble: 0.002, tone: 0.1, grime: 0 }).rotateY(0.08).translate(bx - 0.1, bY, bz + 0.03));
    // Scaffold poles leaning in the corner, a coil of rope hung on the end wall.
    for (let k = 0; k < 3; k++) out.wood.push(pole([x0 + t + 0.12 + k * 0.08, E.floorY, z1 - 0.35 - k * 0.12], [x0 + t + 0.05, 2.25 + k * 0.08, z0 + t + 0.08 + k * 0.05], 0.035, lod, seed + 20 + k));
    for (let k = 0; k < 3; k++) {
      const c = new TorusGeometry(0.17 - k * 0.006, 0.02, lod ? 4 : 6, lod ? 12 : 22);
      c.rotateY(Math.PI / 2);
      c.translate(x0 + t + 0.04 + k * 0.02, 1.62 - k * 0.01, -0.95 + k * 0.012);
      out.rope.push(tintGeometry(boxUV(c), () => 0.9 - k * 0.08));
    }
  }
  // The guild's sign hung under the front beam: a painted board, COLLEGIVM FABRVM in red.
  const sy = eaveY - 0.47;
  const sx = -0.62;
  out.paint.push(slab(1.34, 0.17, 0.035, { bevel: 0.006, seed: seed + 30, wobble: 0, tone: 0.02, grime: 0 }).translate(sx, sy, z1 - 0.03));
  if (lod < 2) for (const s of [-1, 1]) out.iron.push(box(0.012, 0.13, 0.012, sx + s * 0.55, sy + 0.16, z1 - 0.03));
  if (lod === 0) out.letters.push(...inscription('COLLEGIVM·FABRVM', sy + 0.045, z1 - 0.01, 0.082).map((g) => g.translate(sx, 0, 0)));
  else if (lod === 1) out.letters.push(box(1.12, 0.08, 0.006, sx, sy + 0.045, z1 - 0.012));
  // The lantern's bracket on the right wall's front end.
  if (lod < 2) {
    const [lx, ly, lz] = E.lamp;
    out.iron.push(tube([[lx, ly + 0.42, z1 + 0.005], [lx, ly + 0.42, lz - 0.1], [lx, ly + 0.36, lz]], 0.012, { radial: 4, segments: 4, around: 0.3 }));
  }
}

/** The tools. Each returns geometries by material, built at the origin (see each). */
const TOOLS = {
  /** A frame saw (serra): two arms and a stretcher, the blade across the bottom; lying flat in x-z, 0.7 long. */
  saw(lod) {
    const wood = [box(0.7, 0.03, 0.03, 0, 0, 0.27), box(0.03, 0.03, 0.3, -0.33, 0, 0.13), box(0.03, 0.03, 0.3, 0.33, 0, 0.13)];
    const iron = [box(0.68, 0.006, 0.035, 0, 0.012, 0)];
    if (lod === 0) iron.push(...[-1, 1].map((s) => box(0.025, 0.02, 0.025, s * 0.33, 0.01, 0)));
    return { wood, iron };
  },
  /** A mallet: a turned head on a handle, lying along x. */
  mallet(lod) {
    const head = new CylinderGeometry(0.06, 0.06, 0.16, lod ? 7 : 12, 1);
    head.translate(0, 0.06, 0);
    const wood = [tintGeometry(boxUV(head), () => 0.85), box(0.3, 0.03, 0.03, 0.15, 0.045, 0)];
    return { wood, iron: [] };
  },
};

/** The tool rack on the right wall's outer face (+x): saw, square, level, plumb bob, compass, adze; the mallet. */
function rack(lod, seed, out) {
  const { x1, z0 } = E.shed;
  const xs = x1 + 0.045;
  // Two battens with pegs.
  for (const y of [1.08, 1.72]) out.wood.push(slab(0.04, 0.08, 1.2, { bevel: 0.006, seed: seed + y * 10, wobble: 0.002, tone: 0.06, grime: 0 }).translate(xs - 0.01, y, -1.02));
  if (lod === 2) return;
  // Hung flat against the wall: build a tool in x-y (its face toward +z), turned to face +x.
  const onWall = (g, z, y) => g.rotateY(Math.PI / 2).translate(xs + 0.035, y, z);
  // The set square (norma): two flat arms at right angles, hung by its corner.
  for (const [a, b] of [[[0, 0], [0.42, 0]], [[0, 0], [0, -0.42]]]) {
    const g = box(Math.abs(b[0] - a[0]) + 0.04, Math.abs(b[1] - a[1]) + 0.04, 0.018, (a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 0.02, 0);
    out.wood.push(onWall(g, -1.55, 1.68));
  }
  // The level (libella): an A of two legs and a bar, a plumb line from its apex to a mark on the bar.
  for (const s of [-1, 1]) out.wood.push(onWall(beam([0, 0.52, 0], [s * 0.3, 0, 0], 0.025, seed + s, lod), -1.0, 1.0));
  out.wood.push(onWall(box(0.46, 0.025, 0.02, 0, 0.18, 0), -1.0, 1.0));
  if (lod === 0) {
    out.rope.push(onWall(tube([[0, 0.5, 0.012], [0, 0.22, 0.012]], 0.003, { radial: 3, segments: 1, around: 0.05 }), -1.0, 1.0));
    out.bronze.push(onWall(revolve(profileOf([[0, 0], [0.012, 0.012], [0.018, 0.03], [0.008, 0.04], [0, 0.042]]), { segments: 8, metres: 0.1 }).translate(0, 0.2, 0.012), -1.0, 1.0));
  }
  // A plumb bob on its cord from a peg.
  out.rope.push(onWall(tube([[0, 0, 0.01], [0, -0.32, 0.01]], 0.003, { radial: 3, segments: 1, around: 0.05 }), -0.56, 1.7));
  out.bronze.push(onWall(revolve(profileOf([[0, 0], [0.02, 0.02], [0.03, 0.05], [0.015, 0.07], [0, 0.075]]), { segments: lod ? 6 : 10, metres: 0.1 }).translate(0, -0.4, 0.02), -0.56, 1.7));
  // The compass (circinus): two bronze legs from a hinge.
  if (lod === 0) {
    for (const s of [-1, 1]) out.bronze.push(onWall(tube([[0, 0, 0.01], [s * 0.05, -0.24, 0.01]], 0.006, { radial: 4, segments: 1, around: 0.05 }), -0.4, 1.64));
  }
  // The adze (ascia): a handle and its blade across the end.
  out.wood.push(onWall(box(0.035, 0.38, 0.03, 0, -0.38, 0), -1.3, 1.7));
  out.iron.push(onWall(box(0.14, 0.04, 0.02, 0.04, -0.03, 0.015), -1.3, 1.7));
  // The saw and the mallet, when the yard is idle: put away on the lower batten.
  const saw = TOOLS.saw(lod);
  const hang = (g) => g.rotateX(-Math.PI / 2).translate(0, 0, 0);
  for (const g of saw.wood) out.sawRack.push(onWall(hang(g), -1.3, 0.75));
  for (const g of saw.iron) out.sawIronRack.push(onWall(hang(g), -1.3, 0.75));
  const m = TOOLS.mallet(lod);
  for (const g of m.wood) out.malletRack.push(onWall(g.rotateZ(-Math.PI / 2), -0.62, 1.1));
}

/** The groma: the staff, the bracket, the cross, four plumb lines and bobs. */
function groma(lod, out) {
  const [gx, gz, h] = E.groma;
  const y0 = E.floorY;
  const seg = lod === 0 ? 8 : lod === 1 ? 6 : 4;
  // The staff, iron-shod into the ground.
  const staff = new CylinderGeometry(0.018, 0.022, h, seg, 1);
  staff.translate(gx, y0 + h / 2, gz);
  out.wood.push(tintGeometry(boxUV(staff)));
  if (lod < 2) out.iron.push(revolve(profileOf([[0, -0.03], [0.014, -0.02], [0.024, 0.02], [0.024, 0.12], [0, 0.12]]), { segments: seg, metres: 0.1 }).translate(gx, y0, gz));
  // The bracket (rostrum) out from the top, the cross pivoting at its end.
  const top = y0 + h;
  const cx = gx + 0.24;
  out.bronze.push(box(0.26, 0.025, 0.025, gx + 0.12, top - 0.02, gz));
  if (lod < 2) out.bronze.push(revolve(profileOf([[0, 0], [0.022, 0], [0.022, 0.06], [0, 0.07]]), { segments: seg, metres: 0.1 }).translate(cx, top - 0.04, gz));
  const arm = 0.44;
  const ay = top + 0.025;
  // The cross turned a little from the yard's square, as when setting out a line.
  const r = 0.35;
  const ends = [0, 1, 2, 3].map((k) => [cx + Math.cos(r + (k * Math.PI) / 2) * arm, ay, gz + Math.sin(r + (k * Math.PI) / 2) * arm]);
  out.wood.push(beam(ends[0], ends[2], 0.034, 3, lod));
  out.wood.push(beam(ends[1], ends[3], 0.034, 4, lod));
  for (const e of ends) {
    const drop = 0.48;
    if (lod < 2) out.rope.push(tube([[e[0], e[1], e[2]], [e[0], e[1] - drop, e[2]]], 0.0055, { radial: lod ? 3 : 4, segments: 1, around: 0.05 }));
    out.bronze.push(revolve(profileOf([[0, 0], [0.024, 0.028], [0.034, 0.062], [0.014, 0.09], [0, 0.096]]), { segments: lod ? 5 : 9, metres: 0.1 }).translate(e[0], e[1] - drop - 0.096, e[2]));
  }
}

/** The shear legs, their lashing, the pulley, the stays, the windlass, the block and its tongs (hoisted or let down). */
function hoist(lod, seed, out) {
  const [fa, fb] = E.feet;
  const [ax, ay, az] = E.apex;
  const y0 = E.floorY;
  const A = [ax, ay, az];
  // The legs run a little past their crossing.
  for (const [k, f] of [fa, fb].entries()) {
    const d = [ax - f[0], ay - y0, az - f[1]];
    const over = 0.22;
    const len = Math.hypot(...d);
    const end = [ax + (d[0] / len) * over, ay + (d[1] / len) * over, az + (d[2] / len) * over];
    out.poles.push(pole([f[0], y0, f[1]], end, 0.075, lod, seed + k));
    // A flat stone under each foot.
    out.stone.push(slab(0.3, 0.06, 0.3, { bevel: 0.012, seed: seed + 5 + k, wobble: 0.006, tone: 0.08, grime: 0.4 }).translate(f[0], 0, f[1]));
  }
  // The lashing round the crossing.
  if (lod < 2) {
    for (let k = 0; k < (lod ? 2 : 4); k++) {
      const c = new TorusGeometry(0.1, 0.018, lod ? 4 : 6, lod ? 10 : 18);
      c.rotateY(Math.PI / 2);
      c.rotateZ(0.2 * (k - 1.5));
      c.translate(ax, ay - 0.04 + k * 0.035, az);
      out.rope.push(tintGeometry(boxUV(c), () => 0.85));
    }
  }
  // The pulley block hung from the crossing: two cheeks with the sheave between, on an iron pin.
  const py = ay - 0.36;
  out.rope.push(tube([[ax, ay - 0.04, az], [ax, py + 0.13, az]], 0.016, { radial: lod ? 4 : 6, segments: 2, around: 0.06 }));
  for (const s of [-1, 1]) out.wood.push(box(0.035, 0.24, 0.2, ax + s * 0.04, py - 0.12, az));
  if (lod < 2) {
    const sheave = new CylinderGeometry(0.075, 0.075, 0.04, lod ? 8 : 14, 1);
    sheave.rotateZ(Math.PI / 2);
    sheave.translate(ax, py, az);
    out.wood.push(tintGeometry(boxUV(sheave), () => 0.8));
  }
  // The stays: one back to the workshop's corner, one to a stake at the yard's back corner.
  const corner = [E.shed.x1 - 0.06, E.shed.topY - 0.12, E.shed.z0 + 0.06];
  const stake = [1.94, y0, -1.96];
  if (lod < 2) {
    out.rope.push(tube([A, [(A[0] + corner[0]) / 2, (A[1] + corner[1]) / 2 - 0.06, (A[2] + corner[2]) / 2], corner], 0.011, { radial: lod ? 3 : 5, segments: lod ? 4 : 10, around: 0.06 }));
    out.rope.push(tube([A, [(A[0] + stake[0]) / 2 + 0.02, (A[1] + stake[1]) / 2 - 0.05, (A[2] + stake[2]) / 2], [stake[0], stake[1] + 0.3, stake[2]]], 0.011, { radial: lod ? 3 : 5, segments: lod ? 4 : 10, around: 0.06 }));
    out.wood.push(box(0.05, 0.36, 0.05, stake[0] - 0.01, y0 - 0.02, stake[2] + 0.01, 0.8));
  }
  // The windlass (sucula) through the legs a hand above the knee: a roller with the rope wound on it, two handspikes.
  const wy = 0.55;
  const legAt = (f) => {
    const t = (wy - y0) / (ay - y0);
    return [f[0] + (ax - f[0]) * t, f[1] + (az - f[1]) * t];
  };
  const wa = legAt(fa);
  const wb = legAt(fb);
  const wz = (wa[1] + wb[1]) / 2;
  const roller = new CylinderGeometry(0.06, 0.06, wb[0] - wa[0] + 0.2, lod ? 7 : 12, 1);
  roller.rotateZ(Math.PI / 2);
  roller.translate((wa[0] + wb[0]) / 2, wy, wz);
  out.wood.push(tintGeometry(boxUV(roller)));
  const drum = new CylinderGeometry(0.085, 0.085, 0.3, lod ? 7 : 12, 1);
  drum.rotateZ(Math.PI / 2);
  drum.translate(ax, wy, wz);
  out.rope.push(tintGeometry(boxUV(drum), () => 0.9));
  if (lod < 2) {
    for (const [x, r] of [[wa[0] - 0.06, 1.1], [wb[0] + 0.06, -1.25]]) {
      out.wood.push(beam([x, wy - Math.sin(r) * 0.36, wz - Math.cos(r) * 0.36], [x, wy + Math.sin(r) * 0.36, wz + Math.cos(r) * 0.36], 0.035, seed + 9, lod));
    }
  }
  // The block of travertine with its forceps holes, hoisted (open) or let down onto two rollers (shut).
  const bw = 0.62;
  const bh = 0.42;
  const bd = 0.44;
  for (const [state, by] of [['open', 1.32], ['shut', 0.13]]) {
    const list = state === 'open' ? out.blockUp : out.blockDown;
    list.stone.push(slab(bw, bh, bd, { bevel: 0.02, seed: seed + 20, wobble: 0.006, tone: 0.05, grime: 0.25 }).translate(ax, by, az));
    // The tongs: two bent iron arms from a ring over the block into holes in its sides.
    const top = by + bh;
    for (const s of [-1, 1]) {
      list.iron.push(tube([[ax, top + 0.42, az], [ax + s * 0.12, top + 0.28, az], [ax + s * (bw / 2 + 0.05), top + 0.05, az], [ax + s * (bw / 2 + 0.04), top - 0.16, az], [ax + s * (bw / 2 - 0.02), top - 0.18, az]], 0.016, { radial: lod ? 4 : 6, segments: lod ? 5 : 12, around: 0.1 }));
    }
    if (lod < 2) list.iron.push(tube([[ax, top + 0.5, az - 0.05], [ax, top + 0.56, az], [ax, top + 0.5, az + 0.05], [ax, top + 0.44, az], [ax, top + 0.5, az - 0.05]], 0.012, { radial: 4, segments: 8, around: 0.1 }));
    // The hoisting rope: from the drum up to the sheave's back, over it, down to the ring.
    list.rope.push(tube([[ax, wy + 0.08, wz], [ax, py - 0.02, az - 0.075]], 0.012, { radial: lod ? 3 : 5, segments: 2, around: 0.06 }));
    list.rope.push(tube([[ax, py, az + 0.075], [ax, top + 0.56, az + 0.005]], 0.012, { radial: lod ? 3 : 5, segments: 2, around: 0.06 }));
    if (state === 'shut') {
      // Let down onto two rollers, as stones were moved about a yard.
      for (const dz of [-0.13, 0.13]) {
        const r = new CylinderGeometry(0.06, 0.06, bw + 0.25, lod ? 6 : 10, 1);
        r.rotateZ(Math.PI / 2);
        r.translate(ax, E.floorY + 0.06, az + dz);
        list.wood.push(tintGeometry(boxUV(r), () => 0.8));
      }
    }
  }
}

/** The yard's stock: squared timbers, the mortar trough and pozzolana, bricks, ashlar, chips of stone. */
function stock(lod, seed, out) {
  const y0 = E.floorY;
  const rnd = artRng(seed);
  // Squared timbers on two bearers, along the workshop's front.
  for (const x of [-1.65, -0.55]) out.wood.push(box(0.12, 0.1, 0.6, x, y0, 0.33, 0.8));
  for (const [k, x, y] of [[0, -0.22, 0], [1, 0.0, 0], [2, 0.22, 0], [3, -0.11, 1], [4, 0.11, 1]]) {
    if (lod === 2 && k > 2) break;
    const b = slab(1.7 - k * 0.07, 0.17, 0.18, { bevel: 0.012, seed: seed + k, wobble: 0.004, tone: 0.1, grime: 0.15 });
    b.translate(-1.1 + (rnd() - 0.5) * 0.08, y0 + 0.1 + y * 0.17, 0.33 + x);
    out.timber.push(b);
  }
  // The mortar trough: planks, white slaked lime, a hoe left in it; pozzolana heaped beside.
  const tx = 0.12;
  const tz = 0.62;
  out.wood.push(slab(0.8, 0.22, 0.42, { bevel: 0.01, seed: seed + 10, wobble: 0.003, tone: 0.06, grime: 0.5 }).translate(tx, y0, tz));
  out.lime.push(box(0.72, 0.012, 0.34, tx, y0 + 0.19, tz, 0.95));
  if (lod < 2) {
    out.wood.push(beam([tx + 0.15, y0 + 0.2, tz], [tx + 0.62, y0 + 0.62, tz + 0.18], 0.03, seed + 11, lod));
    out.iron.push(box(0.012, 0.1, 0.16, tx + 0.13, y0 + 0.12, tz));
  }
  const heap = revolve(profileOf([[0, 0], [0.4, 0], [0.33, 0.07], [0.2, 0.18], [0.07, 0.24], [0, 0.25]]), {
    segments: lod === 0 ? 14 : lod === 1 ? 9 : 6, metres: 0.6,
    deform: (p, th) => { const k = 1 + 0.08 * Math.sin(th * 3 + 1) + 0.05 * Math.sin(th * 5); p.x *= k; p.z *= k; },
  });
  out.sand.push(heap.translate(0.7, y0, 0.22));
  // Bricks: square bessales (two thirds of a foot) in crossed courses on a pallet.
  const kx = 0.42;
  const kz = 1.38;
  out.wood.push(box(0.7, 0.06, 0.7, kx, y0, kz, 0.75));
  const courses = 8;
  const bt = 0.046;
  const bs = 0.2;
  if (lod === 0) {
    for (let c = 0; c < courses; c++) {
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (c === courses - 1 && i * 3 + j > 4) continue; // the top course partly taken
          const g = slab(bs - 0.006, bt - 0.004, bs - 0.006, { bevel: 0.004, seed: seed + c * 9 + i * 3 + j, wobble: 0.003, tone: 0.12, grime: 0 });
          const ox = (c % 2 ? 0.01 : -0.01);
          out.bricks.push(g.translate(kx - bs + i * bs + ox, y0 + 0.06 + c * bt, kz - bs + j * bs - ox));
        }
      }
    }
  } else {
    // (Far out: the stack as courses.)
    for (let c = 0; c < (lod === 1 ? courses : 1); c++) {
      const h = lod === 1 ? bt - 0.004 : bt * courses;
      out.bricks.push(slab(3 * bs, h, 3 * bs, { bevel: 0.004, seed: seed + c, wobble: 0.003, tone: 0.08, grime: 0 }).translate(kx, y0 + 0.06 + c * bt, kz));
    }
  }
  // Ashlar: two blocks of tufa on the ground, one of travertine across them, a square and a chisel on it.
  const sx = 1.38;
  const sz = 1.15;
  out.tufa.push(slab(0.62, 0.42, 0.46, { bevel: 0.02, seed: seed + 30, wobble: 0.008, tone: 0.06, grime: 0.35 }).translate(sx, y0, sz - 0.27));
  out.tufa.push(slab(0.62, 0.42, 0.46, { bevel: 0.02, seed: seed + 31, wobble: 0.008, tone: 0.06, grime: 0.35 }).rotateY(0.04).translate(sx + 0.02, y0, sz + 0.24));
  out.stone.push(slab(0.48, 0.36, 0.9, { bevel: 0.02, seed: seed + 32, wobble: 0.006, tone: 0.05, grime: 0.1 }).rotateY(-0.05).translate(sx - 0.02, y0 + 0.42, sz));
  if (lod < 2) {
    const top = y0 + 0.78;
    out.wood.push(box(0.3, 0.012, 0.035, sx - 0.05, top, sz - 0.1));
    out.wood.push(box(0.035, 0.012, 0.3, sx - 0.185, top, sz + 0.035));
    out.iron.push(box(0.012, 0.012, 0.2, sx + 0.12, top, sz + 0.2));
  }
  // Chips of stone round the ashlar, from dressing it.
  if (lod === 0) {
    for (let k = 0; k < 26; k++) {
      const g = new IcosahedronGeometry(0.02 + rnd() * 0.025, 0);
      g.scale(1, 0.4, 1);
      const a = rnd() * Math.PI * 2;
      const r = 0.45 + rnd() * 0.4;
      const x = Math.max(-1.95, Math.min(1.95, sx + Math.cos(a) * r));
      const z = Math.max(-1.95, Math.min(1.95, sz + Math.sin(a) * r));
      g.translate(x, y0 + 0.008, z);
      out.chips.push(tintGeometry(boxUV(g), () => 0.9 + rnd() * 0.15));
    }
  }
}

/** Build the engineer's post: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildEngineerPost({ lod = 0, seed = 23 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const tagged = () => ({ stone: [], iron: [], rope: [], wood: [] });
  const out = {
    rubble: [], plaster: [], frame: [], wood: [], tile: [], dark: [], rope: [], iron: [], bronze: [], paint: [], letters: [], poles: [], stone: [],
    tufa: [], timber: [], lime: [], sand: [], bricks: [], chips: [], blockUp: tagged(), blockDown: tagged(),
    sawRack: [], sawIronRack: [], malletRack: [], benchTools: [], benchIron: [],
  };
  const H = E.half - 0.02;
  // The yard: beaten earth over the whole tile.
  out.earth = [slab(2 * H, E.floorY, 2 * H, { bevel: 0.015, seed: seed + 1, wobble: 0, tone: 0, grime: 0 })];
  workshop(lod, seed + 10, out);
  rack(lod, seed + 40, out);
  groma(lod, out);
  hoist(lod, seed + 60, out);
  stock(lod, seed + 80, out);
  // The saw and the mallet out on the bench while the yard works.
  if (lod < 2) {
    const bY = 0.8;
    const bz = E.shed.z0 + E.shed.t + 0.28;
    const saw = TOOLS.saw(lod);
    for (const g of saw.wood) out.benchTools.push(g.rotateY(0.15).translate(-1.2, bY, bz - 0.12));
    for (const g of saw.iron) out.benchIron.push(g.rotateY(0.15).translate(-1.2, bY, bz - 0.12));
    for (const g of TOOLS.mallet(lod).wood) out.benchTools.push(g.rotateY(-0.5).translate(-0.4, bY, bz - 0.02));
  }
  // Far out (a tile a few dozen pixels across) the ropes, the iron, the groma's bobs, the sign, the lime
  // and the floor's shade are a pixel or two, and each material and state is one more draw call for
  // every yard in view: left out.
  if (lod === 2) {
    out.rope = out.iron = out.bronze = out.paint = out.lime = out.dark = [];
    for (const b of [out.blockUp, out.blockDown]) b.rope = b.iron = [];
  }
  const mats = {
    earth:material('beaten-earth', { surface: 'earth', vertexColors: true, snow: 1 }),
    rubble: material('rubble-wall', { surface: 'rubble', vertexColors: true, snow: 1 }),
    plaster: material('plaster', { surface: 'plaster', vertexColors: true, snow: 1 }),
    wood: material('wood', { surface: 'wood', vertexColors: true, snow: 1 }),
    bark: material('bark', { surface: 'bark', vertexColors: true, snow: 0.6 }),
    tile: material('roof-tile', { surface: 'terracotta', vertexColors: true, snow: 1 }),
    brick: material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 0.8 }),
    iron: material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }),
    bronze: material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }),
    rope: material('rope', { surface: 'rope', vertexColors: true, snow: 0.6, normal: 1 }),
    trav: material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 }),
    tufa: material('tufa', { surface: 'tufa', vertexColors: true, snow: 1 }),
    paint: material('paint', { color: 0xffffff, roughness: 0.6, vertexColors: true, snow: 0.8 }),
    letters: material('inscription-red', { color: 0x6a1e14, roughness: 0.8, snow: 0.3 }),
    lime: material('slaked-lime', { color: 0xe9e5da, roughness: 0.95, vertexColors: true, snow: 0.6 }),
    sand: material('pozzolana', { surface: 'earth', color: 0xb0745a, vertexColors: true, snow: 1 }),
  };
  // (The sign's board painted cream: the paint material's colour is in its vertices.)
  for (const g of out.paint) tintGeometry(g, () => lin(0xe6dcc4));
  const p = new TaggedParts('engineer');
  p.add('yard', mats.earth, out.earth);
  p.add('footing', mats.rubble, out.rubble);
  p.add('walls', mats.plaster, out.plaster);
  p.add('frame', mats.wood, out.frame);
  p.add('wood', mats.wood, [...out.wood, ...out.timber]);
  p.add('roof', mats.tile, out.tile);
  p.add('floor', mats.earth, out.dark, { cast: false });
  p.add('rope', mats.rope, out.rope);
  p.add('iron', mats.iron, out.iron);
  p.add('bronze', mats.bronze, out.bronze);
  p.add('sign', mats.paint, out.paint);
  p.add('letters', mats.letters, out.letters, { cast: false });
  p.add('legs', mats.bark, out.poles);
  p.add('stone', mats.trav, [...out.stone, ...out.chips]);
  p.add('tufa', mats.tufa, out.tufa);
  p.add('lime', mats.lime, out.lime, { cast: false });
  p.add('pozzolana', mats.sand, out.sand);
  p.add('bricks', mats.brick, out.bricks);
  for (const [when, b] of [['open', out.blockUp], ['shut', out.blockDown]]) {
    p.add('block', mats.trav, b.stone, { when });
    p.add('tongs', mats.iron, b.iron, { when });
    p.add('hoist-rope', mats.rope, b.rope, { when });
    p.add('rollers', mats.wood, b.wood, { when });
  }
  p.add('tools', mats.wood, [...out.sawRack, ...out.malletRack], { when: 'shut' });
  p.add('tools-iron', mats.iron, out.sawIronRack, { when: 'shut' });
  p.add('tools', mats.wood, out.benchTools, { when: 'open' });
  p.add('tools-iron', mats.iron, out.benchIron, { when: 'open' });
  // The lantern at the workshop's corner: lit while staffed (the lab's night lights its panes), dark when idle.
  if (lod < 2) {
    const [lx, ly, lz] = E.lamp;
    const l = lantern(lx, ly, lz, lod);
    p.add('bronze', mats.bronze, l.bronze);
    p.add('lamp', lanternPane(), [l.pane], { when: 'open', cast: false });
    p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
  }
  // The builders: one at the windlass, the surveyor sighting along the groma's cords.
  if (lod === 0) {
    // (At the windlass's end, out of the way of the hanging block: no one stands under a load.)
    const winder = figureParts({ cloth: 0xa8977a, reach: 0.85 }, E.feet[0][0] - 0.34, E.floorY, -1.32, Math.PI * 0.62);
    for (const f of winder) p.add(`winder-${f.material.name}`, f.material, [f.g], { when: 'open' });
    const [gx, gz] = E.groma;
    const surveyor = figureParts({ cloth: 0xd8cdb4, cloth2: 0x8a6a4a, reach: 0.5 }, gx + 0.1, E.floorY, gz + 0.3, Math.PI * 0.82);
    for (const f of surveyor) p.add(`surveyor-${f.material.name}`, f.material, [f.g], { when: 'open' });
  }
  return p.build();
}


