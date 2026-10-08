/**
 * models/factio.js
 * ----------------------------------------------------------------------------
 * The chariot stable (Factio) of the 3D look, on a 3 x 3 footprint (12 m):
 * the stables of one of the colours of the circus, from the record rather
 * than from the 2D sprite:
 *
 *   - The racing at Rome was run by the four factions, the Reds (russata),
 *     the Whites (albata), the Blues (veneta) and the Greens (prasina), each
 *     with its stables (stabula factionum, in the Campus Martius), its
 *     horses, grooms (conditores), harness makers and drivers (aurigae).
 *     A driver wore his colour's tunic laced with leather straps round the
 *     chest, a cap of felt or leather, the reins tied round his waist.
 *   - The famous horses were honoured by name: the mosaics of stables in
 *     Africa (Sousse, Dougga) show them at their mangers under palms of
 *     victory; a victor's prizes were the palm and the wreath, and the
 *     drivers' inscriptions count their wins.
 *   - Teams were schooled at home: yoked to the light racing car (the
 *     biga's), driven round and round, and the turn about the turning post
 *     (the meta: three cones on a base) practised.
 *
 * So, in 12 m: a range of stalls along the back under a tiled lean-to on
 * posts, low partitions between them, a horse at its manger in each; the
 * tack room at the back left, its front hung with the harness (collars,
 * yokes, coiled reins and bridles) and over it the faction's board, its
 * name painted, between palms of victory and wreaths; the yard of trodden
 * earth with a turning post of three cones in its middle; a team yoked to a
 * car being driven round it at a trot; another team standing in its yoke
 * at the left, grooms at the horses' heads and its driver by; a trough,
 * hay; a low wall, a gate to the street.
 *
 * States (models.js partShows; training.js trainingState):
 *   'open'  staffed: the team trotting round the meta, the other harnessed
 *           with its grooms and driver, a groom carrying feed to the stalls,
 *           one sweeping (factioActors: moving)
 *   'out'   staffed, a team gone to the hippodrome: the harnessed team gone
 *   'shut'  no staff: the horses in their stalls, nobody, the gate shut
 * Its colours its faction's (FACTIO_COLOURS by the building's id: the key).
 *
 * Metres, the middle at the origin, y up, the gate toward +z.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, ConeGeometry, TorusGeometry, RingGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { slab } from './masonry.js';
import { roofSlope } from './learning.js';
import { inscribe } from './castra.js';
import { CHARIOT } from '../walkers/beasts.js';
import { DYES } from '../people/actors.js';
import {
  bag, assemble, lamps, enclosure, trough, hayHeap, palm, wreath, board, box, cyl, staff, lin,
} from './trainingParts.js';

/** The four colours of the circus: their names as painted, their dyes (the walkers' charioteers' too). */
export const FACTIO_COLOURS = Object.freeze([
  Object.freeze({ name: 'RVSSATA', colour: 0xa8322b }),
  Object.freeze({ name: 'ALBATA', colour: 0xe8e2d4 }),
  Object.freeze({ name: 'VENETA', colour: 0x2f5f9e }),
  Object.freeze({ name: 'PRASINA', colour: 0x3f7a3a }),
]);

/** A stable's faction (0 to 3) by its building's id: the same for good. */
export function factionOf(b) {
  const id = b && Number.isFinite(b.id) ? b.id : 3;
  return ((id * 7 + 3) % 4 + 4) % 4;
}

/** The stable's measures (metres): the tests, the lab and the game read them. */
export const FACTIO = Object.freeze({
  half: 6,
  /** The stalls: back wall (z), the posts' line (z), x0, x1, how many. */
  stalls: Object.freeze([-5.95, -3.35, -3.45, 5.95, 4]),
  eave: 2.25,
  top: 2.95,
  /** The tack room: x0, x1, z0, z1, its eave. */
  tack: Object.freeze([-5.95, -3.6, -5.95, -2.5, 2.5]),
  /** The exercise: the turning post (x, z), the car's radius and speed (m/s). */
  meta: Object.freeze([0.9, 1.3]),
  lap: Object.freeze([2.3, 2.4]),
  /** The harnessed team: its car's place (x, z), turned. */
  team: Object.freeze([-4.3, 1.2, 0]),
  gate: Object.freeze([1.4, 2.9]),
  lamps: Object.freeze([Object.freeze([1.2, 1.56, 5.82]), Object.freeze([3.1, 1.56, 5.82])]),
});

const F = FACTIO;

/** The range of stalls: the back wall, partitions, the posts and lean-to roof, a manger at each stall's front, straw. */
function stalls(lod, seed, out) {
  const [zb, zp, x0, x1, n] = F.stalls;
  const t = 0.26;
  out.plaster.push(box(x1 - x0, F.top + 0.15, t, (x0 + x1) / 2, 0, zb + t / 2, 0.88));
  out.tile.push(box(x1 - x0, 0.07, t, (x0 + x1) / 2, F.top + 0.15, zb + t / 2, 0.85));
  out.red.push(box(x1 - x0, 0.9, 0.01, (x0 + x1) / 2, 0, zb + t + 0.005, 0.6));
  const w = (x1 - x0) / n;
  for (let k = 0; k <= n; k++) {
    const x = x0 + k * w;
    // A partition of boards between the stalls, waist high, a post at its front.
    if (k > 0 && k < n) out.wood.push(box(0.06, 1.3, zp - zb - t - 0.2, x, 0, (zb + t + zp - 0.2) / 2, 0.66));
    out.wood.push(box(0.16, F.eave, 0.16, Math.min(x1 - 0.1, Math.max(x0 + 0.1, x)), 0, zp, 0.58));
  }
  out.wood.push(box(x1 - x0, 0.16, 0.2, (x0 + x1) / 2, F.eave - 0.16, zp, 0.62));
  // The mangers along the stalls' fronts (the horses stand facing the yard over them) and their hay racks.
  for (let k = 0; k < n; k++) {
    const cx = x0 + (k + 0.5) * w;
    out.wood.push(box(w - 0.5, 0.32, 0.4, cx, 0.62, zp - 0.12, 0.6), box(0.08, 0.62, 0.08, cx - w / 2 + 0.3, 0, zp - 0.12, 0.55), box(0.08, 0.62, 0.08, cx + w / 2 - 0.3, 0, zp - 0.12, 0.55));
    out.hay.push(box(w - 0.6, 0.1, 0.32, cx, 0.92, zp - 0.12, 0.9));
    out.straw.push(box(w - 0.1, 0.04, zp - zb - t, cx, 0, (zb + t + zp) / 2, (gx, gy, gz) => 0.7 + 0.3 * Math.sin(gx * 11 + gz * 7)));
  }
  const roof = roofSlope([[x0, F.eave, zp + 0.4], [x1, F.eave, zp + 0.4], [x1, F.top + 0.02, zb + 0.15], [x0, F.top + 0.02, zb + 0.15]], { lod, seed });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
}

/** The tack room at the back left: its walls and roof, the harness on its front, the faction's board between palms and wreaths. */
function tackRoom(lod, seed, out, faction) {
  const [x0, x1, z0, z1, eave] = F.tack;
  const t = 0.26;
  out.ashlar.push(box(x1 - x0, 0.3, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0.85));
  out.plaster.push(box(t, eave, z1 - z0, x0 + t / 2, 0.3, (z0 + z1) / 2, 0.9), box(t, eave, z1 - z0, x1 - t / 2, 0.3, (z0 + z1) / 2, 0.9));
  // Its front: a wall with its door, the dado.
  out.plaster.push(box(x1 - x0 - 1.1, eave, t, x0 + (x1 - x0 - 1.1) / 2, 0.3, z1 - t / 2, 0.92), box(0.2, eave, t, x1 - 0.1, 0.3, z1 - t / 2, 0.92));
  out.plaster.push(box(0.9, eave - 1.9, t, x1 - 0.65, 2.2, z1 - t / 2, 0.92));
  out.dark.push(box(0.9, 1.9, 0.02, x1 - 0.65, 0.3, z1 - t + 0.01));
  out.doorShut.push(box(0.86, 1.86, 0.05, x1 - 0.65, 0.32, z1 - 0.04, 0.66));
  out.red.push(box(x1 - x0 - 1.15, 0.7, 0.01, x0 + (x1 - x0 - 1.15) / 2, 0.3, z1 + 0.005, 0.6));
  const roof = roofSlope([[x0, eave + 0.3, z1 + 0.3], [x1 + 0.12, eave + 0.3, z1 + 0.3], [x1 + 0.12, eave + 0.95, z0], [x0, eave + 0.95, z0]], { lod, seed: seed + 3 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  const zf = z1 + 0.02;
  // The faction's board over the harness: its name in its colour on white, a palm each side, wreaths under.
  const { name, colour } = FACTIO_COLOURS[faction];
  const bx = x0 + 0.95;
  board(out, bx, 1.98, zf, 1.0, 0.3, 0xece4d0);
  if (lod < 2) {
    out.paint.push(...inscribe(name, 2.03, zf + 0.04, 0.13).map((g) => tintGeometry(g.translate(bx, 0, 0), () => lin(colour === 0xe8e2d4 ? 0x5a5040 : colour))));
    palm(out, bx - 0.66, 1.7, zf + 0.06, -0.4, 0.75, lod);
    palm(out, bx + 0.62, 1.7, zf + 0.06, Math.PI + 0.4, 0.75, lod);
    for (const [wx, gold] of [[bx - 0.35, false], [bx, true], [bx + 0.35, false]]) wreath(out, wx, 1.65, zf + 0.05, 0, 0.11, lod, { gold });
  }
  // The harness on pegs: yokes, collars, coiled reins, bridles.
  if (lod < 2) {
    for (let k = 0; k < (lod === 0 ? 4 : 2); k++) {
      const hx = x0 + 0.35 + k * 0.42;
      out.wood.push(staff([hx, 1.38, zf - 0.02], [hx, 1.38, zf + 0.12], 0.012, 4));
      const coil = new TorusGeometry(0.12, 0.018, 4, lod === 0 ? 14 : 8);
      coil.translate(hx, 1.27, zf + 0.06);
      (k % 2 ? out.leather : out.rope).push(tintGeometry(boxUV(coil), () => (k % 2 ? 1 : 0.85)));
      if (k % 2 === 0) out.leather.push(box(0.04, 0.38, 0.03, hx + 0.08, 0.98, zf + 0.06, 1));
    }
    // A chariot yoke hung on two pegs along the wall.
    out.wood.push(box(1.25, 0.08, 0.08, x0 + 0.95, 0.88, zf + 0.06, 0.62));
    for (const s of [-1, 1]) out.wood.push(box(0.08, 0.2, 0.08, x0 + 0.95 + s * 0.38, 0.7, zf + 0.06, 0.55));
  }
}

/** The yard: trodden earth, the track's worn ring round the turning post of three cones, a trough and hay. */
function yard(lod, seed, out, ice) {
  out.gravel.push(box(11.9, 0.025, 11.9, 0, 0, 0, (x, y, z) => 0.84 + 0.12 * Math.cos(x * 0.8) * Math.cos(z * 0.6)));
  const [mx, mz] = F.meta;
  const [R] = F.lap;
  // The ring worn by the wheels and hooves: sand.
  const disc = new RingGeometry(R - 0.7, R + 1.4, lod === 0 ? 48 : 24, 1);
  disc.rotateX(-Math.PI / 2);
  disc.translate(mx, 0.028, mz);
  out.sand.push(tintGeometry(boxUV(disc), (gx, gy, gz) => 0.82 + 0.1 * Math.sin(Math.atan2(gz - mz, gx - mx) * 24)));
  // The turning post: a stone base, three cones on it (the circus's meta), a ball on each.
  out.stone.push(slab(1.3, 0.45, 0.6, { bevel: 0.03, seed: seed + 1, wobble: 0.004, tone: 0.04, grime: 0.3 }).translate(mx, 0, mz));
  for (const s of [-0.38, 0, 0.38]) {
    const c = new ConeGeometry(0.15, 1.1, lod === 0 ? 12 : 6);
    c.translate(mx + s, 0.45 + 0.55, mz);
    out.trav.push(tintGeometry(boxUV(c), () => 0.95));
    if (lod < 2) out.gilt.push(tintGeometry(boxUV(new CylinderGeometry(0.05, 0.05, 0.08, 6, 1).translate(mx + s, 1.58, mz)), () => 1));
  }
  trough(out, 5.2, -1.6, 1.6, { alongZ: true, seed: seed + 5 });
  hayHeap(out, 5.0, 0.6, 0.6, 0.55, { lod, seed: seed + 6 });
  if (lod < 2) {
    // Sacks of barley by the stalls.
    for (let k = 0; k < 3; k++) out.linen.push(tintGeometry(new CylinderGeometry(0.17, 0.2, 0.5, lod === 0 ? 8 : 5, 1).translate(-3.0 + k * 0.38, 0.25, -2.85), () => 0.8));
  }
  void ice;
}

/** Build the chariot stable for a faction (0 to 3): { group, meshes, triangles }; meshes tagged in userData.when. */
export function buildFactio({ lod = 0, seed = 491, faction = 3, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bag(['doorOpen', 'doorShut']);
  stalls(lod, seed, out);
  tackRoom(lod, seed + 10, out, faction);
  yard(lod, seed + 20, out, ice);
  enclosure(out, { e: 5.95, g0: F.gate[0], g1: F.gate[1], sides: { l: [F.tack[3], 5.95], r: [F.stalls[1], 5.95] }, seed });
  const { p, m } = assemble('factio', out, lod, { ice });
  p.add('doors', m.wood, out.doorOpen, { when: 'staffed' });
  p.add('doors', m.wood, out.doorShut, { when: 'shut' });
  lamps(p, m, F.lamps, lod);
  // (The horses, the cars, the drivers and the grooms are actors: factioActors.)
  return p.build();
}

/** Horses' coats: [coat, mane and points, socks] (bays, chestnuts, greys, blacks: the African mosaics' colours). */
const COATS = [[0x7a4a28, 0x1d1612, 0x2a1e16], [0x9a5a2a, 0x6a3a1a, 0xe8e0d0], [0xb8b4ac, 0x6e6a64, 0xd8d4cc], [0x2a221c, 0x14100c, 0x2a221c], [0x6a3a20, 0x1d1612, 0xe8e0d0], [0xa86a3a, 0xd8c8a0, 0xa86a3a]];

/** A horse figure: its coat by k, its tack ('yoke' a chariot horse's, '' bare), its clip. */
function horse(k, tack, at, ry, clip, extra = {}) {
  const [coat, mane, socks] = COATS[k % COATS.length];
  return { beast: tack ? `quad:horse:${tack}` : 'quad:horse', clip, at, ry, seed: 100 + k, colours: { skin: coat, mantle: coat, hair: mane, trim: k % 2 ? socks : coat, accent: 0xa3352b, leather: 0x3a2618, metal: 0xb08848 }, ...extra };
}

/**
 * The stable's horses and people (people/actors.js specs, its metres): a
 * horse at the manger of each stall, always. Staffed: a team yoked to its
 * car trotting round the turning post with its driver in his faction's
 * colour, the car and horses going round as one (each horse its own circle
 * at its own speed, so its feet keep the ground); while no team is out
 * ('open') a second team standing in its yoke with a groom at each horse's
 * head and its driver by with his whip; a groom carrying a sack of feed
 * along the stalls, another sweeping. `b` the building (its faction).
 */
export function factioActors(state, b) {
  const { colour } = FACTIO_COLOURS[factionOf(b)];
  const [zb, zp, x0, x1, n] = F.stalls;
  const list = [];
  const w = (x1 - x0) / n;
  for (let k = 0; k < n; k++) list.push(horse(k, '', [x0 + (k + 0.5) * w, 0.03, (zb + zp) / 2 + 0.3], (k % 2 ? 0.12 : -0.1), 'horse:stand'));
  if (state === 'shut') return list;
  const [mx, mz] = F.meta;
  const [R, v] = F.lap;
  const driver = { tunic: colour, trim: colour, leather: 0x4a3020, metal: 0x6e4a2e };
  // The team going round: each horse on its own circle (inside and outside the car's by half the pole's
  // spread) at its own speed, facing its own way round, a lead of `lead` radians ahead of the car (its
  // `phase`, all in step), so its hooves keep the ground; the car and its driver turned half that lead
  // from their circle's way, so the pole points along the chord to the horses' middle (on so tight a
  // turn the light car skids a little, as cars did round the meta).
  const lead = 2 * Math.asin(CHARIOT.horses[0][1] / (2 * R));
  list.push({ body: 'm', dress: ['tunic:short', 'helmet'], hair: 'crop', clip: 'drive', at: [mx, CHARIOT.floor, mz], orbit: { r: R, speed: v, face: lead / 2 }, sync: true, seed: 110, colours: driver });
  list.push({ rigid: 'cart:chariot', at: [mx, 0, mz], orbit: { r: R, speed: v, face: lead / 2 }, sync: true, seed: 111, colours: { accent: colour } });
  CHARIOT.horses.forEach(([hx], i) => {
    // (The car's left, +x, is toward the circle's middle: its way round is counter-clockwise from above.)
    const rho = R - hx;
    list.push(horse(4 + i, 'yoke', [mx, 0, mz], 0, 'horse:trot', { orbit: { r: rho, speed: (v * rho) / R }, phase: (lead * R) / v, sync: true }));
  });
  if (state === 'open') {
    // The other team in its yoke at the left, facing the gate, grooms at their heads.
    const [tx, tz] = F.team;
    list.push({ rigid: 'cart:chariot', at: [tx, 0, tz], ry: 0, seed: 112, colours: { accent: colour } });
    CHARIOT.horses.forEach(([hx, hz], i) => {
      list.push(horse(2 + i, 'yoke', [tx + hx, 0, tz + hz], 0, 'horse:stand'));
      list.push({ body: 'm', dress: ['tunic:short'], hair: 'curls', clip: 'hold', at: [tx + hx + (i ? -0.7 : 0.7), 0.03, tz + hz + 1.05], ry: i ? Math.PI / 2 + 0.5 : -Math.PI / 2 - 0.5, seed: 113 + i, colours: { tunic: DYES.oatmeal } });
    });
    list.push({ body: 'm', dress: ['tunic:short', 'helmet'], hair: 'crop', clip: 'idle', props: { R: 'sprop:whip' }, at: [tx + 0.85, 0.03, tz - 0.3], ry: -0.6, seed: 115, colours: driver });
  }
  // A groom carrying feed along the stalls' fronts, another sweeping.
  list.push({ body: 'm', dress: ['tunic:short'], hair: 'crop', clip: 'carry', props: { L: 'sack' }, at: [x0 + 0.3, 0.03, zp + 0.75], ry: Math.PI / 2, seed: 116, colours: { tunic: DYES.fawn }, route: { length: 6.2, speed: 0.8, pauseEnd: 4, pauseStart: 5, clipEnd: 'give', clipStart: 'idle', faceEnd: Math.PI, faceStart: Math.PI } });
  if (state === 'open') list.push({ body: 'm', dress: ['tunic:short'], hair: 'curls', clip: 'sweep', props: { R: 'broom' }, at: [3.8, 0.03, -2.6], ry: 2.6, seed: 117, colours: { tunic: DYES.undyed } });
  return list;
}
