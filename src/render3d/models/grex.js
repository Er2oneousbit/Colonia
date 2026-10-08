/**
 * models/grex.js
 * ----------------------------------------------------------------------------
 * The actor troupe (Grex) of the 3D look, on a 2 x 2 footprint (8 m): the
 * house and yard of a company of players, from what is known of Roman
 * troupes rather than from the 2D sprite:
 *
 *   - A grex was a company under its manager, the dominus gregis, who
 *     bought the plays, trained the actors (mostly slaves and freedmen) and
 *     hired them out to the magistrates giving the games: Ambivius Turpio,
 *     who staged Terence, speaks in his prologues as such a manager.
 *   - The mosaic from the House of the Tragic Poet at Pompeii shows a
 *     rehearsal: the masks set out on a table, the actors being dressed in
 *     their costumes, a piper playing the double pipes (tibiae), the master
 *     seated among them. Every part was played in a mask (persona): the
 *     tragic masks pale, open mouthed, with the tall onkos of hair, the
 *     comic ones ruddy and grinning; the tragic actor in a long sleeved robe
 *     (the syrma) to the ground.
 *   - A Roman stage (pulpitum) was a low platform of boards before a
 *     painted wall with three doors (the scaenae frons: the middle door the
 *     king's, the side doors the guests'); Horace has Thespis carry his
 *     plays about the country on wagons, and companies toured the towns.
 *
 * So, in 8 m: the house of the company along the back, its stuccoed front
 * the stage's wall (a red dado, red and ochre panels, three doors, the
 * middle one curtained), the masks hung on pegs on it; the stage of boards
 * before it, a step up at its end; a rail of costumes airing at the left
 * (the syrma in saffron, purple, white and rose), the costume chests and
 * a wig on its stand; the touring cart at the front right, loaded with
 * chests and a rolled backdrop under its tilt; a low wall and a gate to the
 * street.
 *
 * States (models.js partShows; training.js trainingState):
 *   'open'  staffed, the company at home: three players rehearsing on the
 *           stage in their masks, the manager directing from his stool with
 *           the script, the piper with his tibiae, a slave carrying a
 *           costume to the cart (grexActors: people/actors.js, moving)
 *   'out'   staffed, the players gone to a theatre: the cart gone with them
 *           and the costumes and masks they took; the manager at his script,
 *           a slave sweeping the stage
 *   'shut'  no staff: the doors shut, the cart home under its tilt, nobody
 * Tags: 'staffed' (open or out), 'home' (open or shut: what tours), 'shut'.
 *
 * Metres, the middle at the origin, y up, the street toward +z.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, BoxGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { slab } from './masonry.js';
import { cart } from './rural.js';
import { roofSlope } from './learning.js';
import { inscribe } from './castra.js';
import { SEAT_H } from '../people/clips.js';
import { DYES } from '../people/actors.js';
import {
  bag, assemble, lamps, enclosure, chest, hungMask, hungRobe, wigStand, box, cyl, staff, lin,
} from './trainingParts.js';

/** The troupe's measures (metres): the tests, the lab and the game read them. */
export const GREX = Object.freeze({
  half: 4,
  /** The back range (x0, x1, z0, z1: its front wall's face at z1), its eave over the yard, the back wall's top. */
  range: Object.freeze([-3.95, 3.95, -3.95, -2.45]),
  eave: 3.0,
  top: 3.6,
  /** The stage: x0, x1, z0 (the wall), z1 (its front), its floor's height. */
  stage: Object.freeze([-3.0, 2.7, -2.45, -0.75, 0.62]),
  /** The doors in the stage's wall: [x, width, height] (the middle one the king's). */
  doors: Object.freeze([Object.freeze([-2.05, 0.9, 1.85]), Object.freeze([0, 1.25, 2.1]), Object.freeze([2.05, 0.9, 1.85])]),
  /** The rail of costumes: its line (x), from z0 to z1, its height. */
  rail: Object.freeze([-3.45, -0.25, 2.35, 1.85]),
  /** The touring cart: its middle (x, z), its turn. */
  cart: Object.freeze([2.15, 2.15, -0.42]),
  /** The manager's stool (x, z), its top's height. */
  stool: Object.freeze([2.95, 0.15, 0.46]),
  /** The gate (x0, x1) and its lanterns. */
  gate: Object.freeze([-0.75, 0.75]),
  lamps: Object.freeze([Object.freeze([-0.95, 1.55, 3.82]), Object.freeze([0.95, 1.55, 3.82])]),
});

const G = GREX;

/** The company's house: its walls, the painted stage wall with its doors, the masks on it, the lean-to roof. */
function house(lod, seed, out) {
  const [x0, x1, z0, z1] = G.range;
  const t = 0.24;
  const sy = G.stage[4];
  // Footing, back and end walls up to the roof's line.
  out.ashlar.push(box(x1 - x0, 0.3, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0.85));
  // (The back wall stands a little over the roof's top, coped with tiles: the slope's upper edge hides behind it.)
  out.plaster.push(box(x1 - x0, G.top - 0.1, t, (x0 + x1) / 2, 0.3, z0 + t / 2, 0.9));
  out.tile.push(box(x1 - x0 + 0.08, 0.07, t + 0.1, (x0 + x1) / 2, G.top + 0.2, z0 + t / 2, 0.85));
  for (const x of [x0 + t / 2, x1 - t / 2]) {
    const g = box(t, 1, z1 - z0, x, 0, (z0 + z1) / 2, 0.9);
    const p = g.attributes.position;
    // (Their tops follow the roof from the back wall's top down to the eave.)
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.5) p.setY(i, G.top + (G.eave - G.top) * ((p.getZ(i) - z0) / (z1 - z0)));
    g.computeVertexNormals();
    out.plaster.push(g);
  }
  // The stage wall: a face with three openings, built as piers and lintels between them.
  const zf = z1 - t / 2;
  const edges = [x0];
  for (const [dx, w] of G.doors) edges.push(dx - w / 2, dx + w / 2);
  edges.push(x1);
  for (let k = 0; k < edges.length; k += 2) out.plaster.push(box(edges[k + 1] - edges[k], G.eave - 0.3, t, (edges[k] + edges[k + 1]) / 2, 0.3, zf, 0.92));
  for (const [dx, w, h] of G.doors) {
    const top = sy + h;
    out.plaster.push(box(w, G.eave - top, t, dx, top, zf, 0.92));
    out.plaster.push(box(w, sy - 0.3, t, dx, 0.3, zf, 0.92));
    // The opening's dark inside, its threshold of travertine, a moulded frame.
    out.dark.push(box(w, h, 0.02, dx, sy, zf - t / 2 + 0.01));
    out.trav.push(slab(w + 0.12, 0.05, t + 0.06, { bevel: 0.01, seed: seed + dx * 3, wobble: 0.002, tone: 0.03, grime: 0.2 }).translate(dx, sy - 0.02, zf));
    if (lod < 2) {
      for (const s of [-1, 1]) out.trav.push(box(0.09, h + 0.05, 0.05, dx + s * (w / 2 + 0.045), sy, z1 + 0.02, 0.9));
      out.trav.push(box(w + 0.3, 0.12, 0.07, dx, sy + h + 0.02, z1 + 0.025, 0.92));
    }
  }
  // The painted wall: a dark red dado over the stage, red and ochre panels framed white between the doors, a frieze.
  const zp = z1 + 0.004;
  for (let k = 0; k < edges.length; k += 2) {
    const a = edges[k] + 0.06;
    const b = edges[k + 1] - 0.06;
    if (b - a < 0.2) continue;
    out.red.push(box(b - a, 0.55, 0.01, (a + b) / 2, sy + 0.02, zp, 0.6));
    out.red.push(box(b - a - 0.16, 0.95, 0.01, (a + b) / 2, sy + 0.72, zp, 1));
  }
  out.ochre.push(box(x1 - x0 - 0.1, 0.22, 0.012, (x0 + x1) / 2, G.eave - 0.32, zp, 0.95));
  // Under the stage's floor: the wall's foot in its socle.
  out.red.push(box(x1 - x0 - 0.1, 0.25, 0.01, (x0 + x1) / 2, 0.32, zp, 0.45));
  // The masks hung on the piers between the doors and beside them: tragic and comic by turns.
  if (lod < 2) {
    const pegs = lod === 0 ? [[-3.35, 'comic'], [-2.95, 'tragic'], [-1.12, 'tragic'], [-0.85, 'comic'], [0.85, 'tragic'], [1.12, 'comic'], [2.95, 'comic'], [3.35, 'tragic']]
      : [[-2.95, 'tragic'], [-1.0, 'comic'], [1.0, 'tragic'], [2.95, 'comic']];
    const hair = [0x2a1e16, 0x6a4428, 0x1d1612, 0x9a7a4a];
    pegs.forEach(([x, kind], i) => {
      // (Those over the costumes the players take on tour are gone with them: 'home'.)
      const list = i % 3 === 1 ? out.homeMasks : out;
      hungMask(list, x, sy + 1.62 + (i % 2) * 0.08, z1 + 0.1, 0, kind, lod, hair[i % 4]);
    });
  }
  // The middle door's curtain (siparium) drawn to one side while the company is at home; the doors shut otherwise.
  const [, mw, mh] = G.doors[1];
  const curtain = new BoxGeometry(mw * 0.45, mh - 0.06, 0.02, lod === 0 ? 6 : 2, 1, 1);
  const cp = curtain.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, cp.getZ(i) + 0.03 * Math.sin(cp.getX(i) * 28));
  curtain.computeVertexNormals();
  curtain.translate(-mw * 0.27, sy + (mh - 0.06) / 2, z1 - 0.02);
  out.curtainOpen.push(tintGeometry(boxUV(curtain), (px) => { const c = lin(0x7a2a3a); const k = 0.8 + 0.2 * Math.sin(px * 30); return [c[0] * k, c[1] * k, c[2] * k]; }));
  for (const [dx, w, h] of G.doors) out.doorShut.push(box(w - 0.04, h - 0.04, 0.05, dx, sy + 0.02, z1 - 0.06, 0.7));
  // GREX painted on the frieze.
  if (lod === 0) out.letters.push(...inscribe('GREX', G.eave - 0.29, z1 + 0.012, 0.15).map((g) => g.translate(2.7, 0, 0)));
  // The lean-to roof from the back wall down over the stage's wall to the yard.
  const roof = roofSlope([[x0 - 0.12, G.eave, z1 + 0.42], [x1 + 0.12, G.eave, z1 + 0.42], [x1 + 0.12, G.top + 0.04, z0 - 0.1], [x0 - 0.12, G.top + 0.04, z0 - 0.1]], { lod, seed: seed + 9 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
}

/** The stage: a platform of boards on posts before the wall, its front boarded, a step up at its right end. */
function stage(lod, seed, out) {
  const [x0, x1, z0, z1, h] = G.stage;
  // The floor of planks running along x, each its own tone.
  const n = lod === 0 ? 9 : lod === 1 ? 4 : 1;
  for (let k = 0; k < n; k++) {
    const za = z0 + ((z1 - z0) * k) / n;
    const zb = z0 + ((z1 - z0) * (k + 1)) / n;
    out.wood.push(box(x1 - x0, 0.05, zb - za - (n > 1 ? 0.01 : 0), (x0 + x1) / 2, h - 0.05, (za + zb) / 2, 0.82 + 0.08 * ((k * 5) % 3 - 1)));
  }
  // Its front of upright boards, its posts.
  out.wood.push(box(x1 - x0, h - 0.05, 0.04, (x0 + x1) / 2, 0, z1 - 0.02, (gx) => 0.62 + 0.06 * Math.sin(gx * 9)));
  out.wood.push(box(0.04, h - 0.05, z1 - z0, x0 + 0.02, 0, (z0 + z1) / 2, 0.6), box(0.04, h - 0.05, z1 - z0, x1 - 0.02, 0, (z0 + z1) / 2, 0.6));
  if (lod < 2) for (let x = x0 + 0.1; x < x1; x += 0.95) out.wood.push(box(0.09, h - 0.05, 0.06, x, 0, z1 + 0.01, 0.5));
  // A step up at the right end.
  for (let k = 0; k < 2; k++) out.wood.push(box(0.6, (h * (k + 1)) / 3, 0.36, x1 + 0.3, 0, z1 - 0.3 - k * 0.36, 0.72));
  // The prompter's little desk at the stage's left end: a board on a post, a roll on it.
  if (lod < 2) {
    out.wood.push(box(0.06, 0.95, 0.06, x0 + 0.35, h, z1 - 0.3, 0.6), box(0.36, 0.03, 0.26, x0 + 0.35, h + 0.95, z1 - 0.3, 0.75));
    out.paint.push(tintGeometry(new CylinderGeometry(0.025, 0.025, 0.24, 6, 1).rotateZ(Math.PI / 2).translate(x0 + 0.35, h + 1.0, z1 - 0.3), () => lin(0xd8c49a)));
  }
}

/** The rail of costumes, the chests and a wig on its stand, at the yard's left. */
function wardrobe(lod, seed, out) {
  const [x, za, zb, h] = G.rail;
  for (const z of [za, zb]) out.wood.push(box(0.1, h + 0.1, 0.1, x, 0, z, 0.7));
  out.wood.push(staff([x, h, za], [x, h, zb], 0.025, 6));
  const robes = [[DYES.saffron, 'home'], [DYES.murex, 'always'], [DYES.white, 'home'], [DYES.rose, 'always'], [DYES.woad, 'home']];
  const n = lod === 0 ? 5 : 3;
  for (let k = 0; k < n; k++) {
    const [c, when] = robes[k];
    const z = za + 0.35 + ((zb - za - 0.7) * k) / (n - 1);
    hungRobe(when === 'home' ? out.homeRobes : out, x, h - 0.02, z, Math.PI / 2, c, lod, { seed: seed + k, drop: 1.25 + 0.1 * (k % 2) });
  }
  chest(out, -2.7, 2.95, 0.8, 0.5, 0.48, { ry: 0.25, open: true, colour: 0x7a5434, lod });
  chest(out, -3.25, 3.3, 0.7, 0.45, 0.42, { ry: -0.1, colour: 0x5a3a24, lod });
  if (lod < 2) {
    // A costume folded over the open chest's edge, a wig on its stand by it.
    out.cloth.push(tintGeometry(box(0.5, 0.06, 0.34, -2.65, 0.48, 3.0, 1).rotateY(0.25), () => lin(DYES.saffron)));
    wigStand(out, -2.0, 3.25, lod, 0x6a4428);
  }
}

/**
 * The touring cart at the front right: the farms' cart (rural.js cart, its
 * pole on the ground) with the company's things on its bed, two chests and
 * the painted backdrop rolled on its poles, under a tilt of canvas on hoops.
 * Built in the bed's frame and tilted as the bed is.
 */
function touringCart(lod, seed, out) {
  const [cx, cz, ry] = G.cart;
  const c = cart(lod, seed);
  const load = [];
  const canvas = [];
  // (The bed's top: cart() tilts the bed 0.12 rad about x and lifts it to 0.51 m, back 0.1 m.)
  load.push(box(0.7, 0.42, 0.5, -0.12, 0.05, -0.45, 0.8), box(0.62, 0.38, 0.46, 0.15, 0.05, 0.25, 0.7));
  if (lod < 2) {
    // The backdrop rolled on its poles across the chests, its painted edge showing.
    const roll = new CylinderGeometry(0.11, 0.11, 1.6, lod === 0 ? 12 : 6, 1).rotateX(Math.PI / 2).translate(0.3, 0.55, -0.1);
    canvas.push(tintGeometry(boxUV(roll), (px, py, pz) => (Math.abs(pz + 0.1) > 0.74 ? lin(0x3f5a85) : lin(0xd8cba8))));
  }
  // The tilt: three hoops and the canvas over the front half.
  const hoops = lod === 0 ? 3 : 2;
  for (let k = 0; k < hoops; k++) {
    const z = -0.75 + (0.75 * k) / Math.max(1, hoops - 1);
    const arc = new CylinderGeometry(0.58, 0.58, 0.04, lod === 0 ? 10 : 6, 1, true, -Math.PI / 2, Math.PI);
    arc.rotateX(Math.PI / 2);
    arc.rotateZ(Math.PI / 2);
    arc.translate(0, 0.25, z);
    load.push(tintGeometry(boxUV(arc), () => 0.6));
  }
  const tilt = new CylinderGeometry(0.6, 0.6, 0.8, lod === 0 ? 12 : 6, 1, true, -Math.PI / 2, Math.PI);
  tilt.rotateX(Math.PI / 2);
  tilt.rotateZ(Math.PI / 2);
  tilt.translate(0, 0.25, -0.38);
  canvas.push(tintGeometry(boxUV(tilt), (px, py, pz) => 0.85 + 0.1 * Math.sin(pz * 20)));
  for (const g of [...load, ...canvas]) {
    g.rotateX(0.12);
    g.translate(0, 0.51, -0.1);
  }
  const place = (g) => g.rotateY(ry).translate(cx, 0, cz);
  out.cartWood.push(...c.wood.map(place), ...load.map(place));
  out.cartIron.push(...c.iron.map(place));
  out.cartCanvas.push(...canvas.map(place));
}

/** The yard: trodden gravel, a paved strip by the gate, a bench along the right wall. */
function yard(lod, seed, out) {
  out.gravel.push(box(7.9, 0.03, 7.9, 0, 0, 0, (x, y, z) => 0.86 + 0.14 * Math.cos(x * 0.9) * Math.cos(z * 0.8)));
  out.flags.push(box(1.6, 0.035, 1.2, 0, 0, 3.3, 0.9));
  // The manager's stool before the stage, a low table with the masks for the scene set out on it.
  const [sx, sz, sh] = G.stool;
  for (const s of [-1, 1]) out.wood.push(staff([sx - 0.17, 0, sz + s * 0.15], [sx + 0.17, sh, sz + s * 0.15], 0.015, 4), staff([sx + 0.17, 0, sz + s * 0.15], [sx - 0.17, sh, sz + s * 0.15], 0.015, 4));
  out.leather.push(box(0.38, 0.03, 0.36, sx, sh, sz, 1));
  out.wood.push(box(0.9, 0.05, 0.5, 3.15, 0.62, 1.1, 0.8));
  for (const [dx, dz] of [[-0.38, -0.2], [0.38, -0.2], [-0.38, 0.2], [0.38, 0.2]]) out.wood.push(box(0.05, 0.62, 0.05, 3.15 + dx, 0, 1.1 + dz, 0.6));
  if (lod < 2) {
    hungMask(out, 2.95, 0.66, 1.08, 0.3, 'tragic', lod, 0x2a1e16);
    hungMask(out, 3.35, 0.66, 1.12, -0.2, 'comic', lod, 0x6a4428);
  }
  enclosure(out, { e: 3.95, g0: G.gate[0], g1: G.gate[1], sides: [-2.45, 3.95], seed });
}

/** Build the actor troupe: { group, meshes, triangles }; meshes tagged in userData.when. */
export function buildGrex({ lod = 0, seed = 401 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bag(['doorOpen', 'doorShut', 'curtainOpen', 'homeMasks', 'homeRobes', 'cartWood', 'cartIron', 'cartCanvas']);
  // (The masks and robes that tour gather their own lists by material, shown while 'home'.)
  out.homeMasks = bag();
  out.homeRobes = bag();
  house(lod, seed, out);
  stage(lod, seed + 20, out);
  wardrobe(lod, seed + 40, out);
  touringCart(lod, seed + 60, out);
  yard(lod, seed + 80, out);
  const { p, m } = assemble('grex', out, lod);
  p.add('doors', m.wood, out.doorOpen, { when: 'staffed' });
  p.add('doors', m.wood, out.doorShut, { when: 'shut' });
  p.add('curtain', m.cloth, out.curtainOpen, { when: 'staffed', cast: false });
  for (const [k, list] of Object.entries(out.homeMasks)) if (list.length) p.add(`mask-${k}`, m[k] || m.paint, list, { when: 'home', cast: false });
  for (const [k, list] of Object.entries(out.homeRobes)) if (list.length) p.add(`robe-${k}`, m[k] || m.cloth, list, { when: 'home', cast: lod === 0 });
  p.add('cart', m.wood, out.cartWood, { when: 'home' });
  p.add('cart-iron', m.iron, lod < 2 ? out.cartIron : [], { when: 'home', cast: false });
  p.add('cart-tilt', m.linen, out.cartCanvas, { when: 'home' });
  lamps(p, m, G.lamps, lod);
  // (The players, the manager, the piper and the slave are actors: grexActors.)
  return p.build();
}

/** Where a seated actor's feet go for a seat whose top is at height y (clips.js SEAT_H). */
const seatAt = (y) => y - SEAT_H;

/**
 * The troupe's people (people/actors.js specs, its metres). Staffed and at
 * home ('open'): on the stage, in their masks, a tragic hero declaiming in
 * his saffron syrma, a heroine (a man in a woman's mask and robe, as every
 * part was played) answering him, a comic slave capering; before them the
 * manager on his stool with the script, teaching; the piper standing by the
 * stage's end with his tibiae; a slave carrying a costume from the rail to
 * the cart. With the players out ('out'): the manager reading his script on
 * his stool, a slave sweeping the stage. Nobody when it is shut.
 */
export function grexActors(state) {
  if (state === 'shut') return [];
  const sy = G.stage[4];
  const [sx, sz, sh] = G.stool;
  const list = [];
  if (state === 'open') {
    list.push({ body: 'm', dress: ['tunic:long', 'pallium'], hair: 'curls', props: { L: 'sprop:tragic' }, clip: 'orate', at: [-0.7, sy, -1.55], ry: 0.55, seed: 71, colours: { tunic: DYES.saffron, mantle: DYES.murex, hair: 0x1d1612, trim: DYES.saffron } });
    list.push({ body: 'm', dress: ['tunic:long', 'pallium'], hair: 'curls', props: { L: 'sprop:tragic' }, clip: 'recite', at: [0.75, sy, -1.75], ry: -0.75, seed: 72, colours: { tunic: DYES.white, mantle: DYES.sky, hair: 0x9a7a4a } });
    list.push({ body: 'm', dress: ['tunic:short'], hair: 'curls', props: { L: 'sprop:comic' }, clip: 'cheer', at: [1.85, sy, -1.25], ry: -0.4, seed: 73, colours: { tunic: DYES.ochre, trim: 0xb07a52, hair: 0x6a4428 } });
    list.push({ body: 'm', dress: ['tunic:long', 'wreath'], hair: 'curls', props: { R: 'tibiae' }, clip: 'flute', at: [-2.15, 0.03, -0.35], ry: 0.5, seed: 74, colours: { tunic: DYES.white, trim: DYES.madder } });
    list.push({ body: 'm', dress: ['tunic:knee', 'pallium'], hair: 'bald', beard: 'short', old: true, props: { L: 'roll' }, clip: 'teach', at: [sx, seatAt(sh), sz], ry: Math.PI + 0.9, seed: 75, colours: { tunic: DYES.oatmeal, mantle: DYES.walnut } });
    list.push({
      body: 'm', dress: ['tunic:short'], hair: 'crop', clip: 'bundle', props: { L: 'wprop:bundle' }, at: [-2.75, 0.03, 1.15], ry: Math.atan2(4.0, 0.95), seed: 76,
      colours: { tunic: DYES.fawn, mantle: DYES.saffron, skin: 0x8c5e40 },
      route: { length: 3.4, speed: 0.75, pauseEnd: 5, pauseStart: 6, clipEnd: 'give', clipStart: 'reach', faceStart: -Math.PI / 2 },
    });
  } else {
    list.push({ body: 'm', dress: ['tunic:knee', 'pallium'], hair: 'bald', beard: 'short', old: true, props: { R: 'rollOpen' }, clip: 'read', at: [sx, seatAt(sh), sz], ry: Math.PI + 0.9, seed: 75, colours: { tunic: DYES.oatmeal, mantle: DYES.walnut } });
    list.push({ body: 'm', dress: ['tunic:short'], hair: 'curls', clip: 'sweep', props: { R: 'broom' }, at: [-1.4, sy, -1.2], ry: 1.2, seed: 77, colours: { tunic: DYES.brownWool } });
  }
  return list;
}
