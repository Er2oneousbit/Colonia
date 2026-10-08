/**
 * ships/designs.js
 * ----------------------------------------------------------------------------
 * The vessels of the 3D look, by kind: their measures, the shape of their
 * hulls, where their masts, sails, benches, steering oars and lantern are.
 * Numbers only (the geometry is hulls.js's, the crews look.js's), so the
 * tests can check that a rower's oar comes out of its port and dips into
 * the water, and that a moored ship keeps off its quay.
 *
 * Designed from the record, not from the 2D sprites:
 *
 *   corbita    the Roman merchantman of the reliefs and mosaics (the
 *              Torlonia relief from Portus, the tomb of Naevoleia Tyche at
 *              Pompeii, the Ostia mosaics of the Piazzale delle
 *              Corporazioni) and of the wrecks (Madrague de Giens, Grand
 *              Congloue): a round, deep hull built shell first, the
 *              sternpost rising into a swan's neck (cheniscus) over the
 *              deckhouse, a square mainsail on a yard and the small artemon
 *              on a mast raked over the bow, two steering oars on the
 *              quarters, a deck over a hold of amphorae
 *   coaster    a small coasting trader of the same build (the Laurons and
 *              Cap del Vol wrecks, ships of 10 to 15 m): one mast, one
 *              steering oar, half decks fore and aft and an open hold
 *   liburnian  the provincial fleet's light bireme (models/harbour.js: the
 *              very hull the Navalia builds on its slip), here afloat with
 *              its mast, yard and sail, its rowers on their benches, the
 *              marines on its fighting decks
 *   lembos     the light, fast open galley of the Illyrian and Ligurian
 *              pirates (Polybius 2.3, Livy 40.18 on the Ligurian
 *              pirates' ships): low, sharp, one bank of oars, a pointed
 *              cutwater, a small dark sail; the generic raiders' and the
 *              Ligurians' and Lusitanians' craft
 *   punic      a Carthaginian war galley after the Marsala ship found off
 *              Lilybaeum (a long, light, black-pitched hull with a ram) and
 *              the Phoenicians' horse-headed prows (the hippoi of the
 *              Khorsabad reliefs)
 *   gaulish    the sea-going ships of the Veneti as Caesar saw them (BG
 *              3.13): flat-bottomed for the shallows, high in the bow and
 *              stern, of oak, the cross beams a foot thick bolted with
 *              iron, anchors on chains, sails of hides; for the Gauls, the
 *              Boii and the Cimbri
 *   fishing    a small open fishing boat (the Sea of Galilee boat, the
 *              fishermen of the Althiburos and Sousse mosaics): thwarts, a
 *              short mast with a small sail, the net heaped in the stern
 *
 * Every hull is in metres in its own frame: the bow toward +z, starboard
 * +x, y up, the keel's bottom amidships at y = 0 before the design is set
 * into the water by its draft (`draft`: the waterline's height over the
 * keel; hulls.js builds everything lowered by it, so a ship's frame has
 * the water at y = 0). They are drawn a little smaller than life beside
 * the people, as the game's buildings are (a 12 m harbour, an 8 m warship).
 * ----------------------------------------------------------------------------
 */

import { hullPoint as liburnianPoint, LIBURNIAN } from '../models/harbour.js';
import { ROW_SHIP } from '../people/clips.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * A hull's surface from its measures: t 0 (stern) to 1 (bow), girth f 0
 * (keel) to 1 (sheer); returns [x, y, z] on the starboard side. `h`:
 *   L, B, D       length, beam, depth amidships (keel to sheer)
 *   sheerAft, sheerFore   how much the sheer rises at the ends (m)
 *   aft, fore     [p, e]: the half-breadth's fall toward each end (1 - u^p)^e
 *   keelAft, keelFore     the keel's rise into each end (m)
 *   sharpAft, sharpFore   where the round section gives way to a V
 *   flat          0..1: a flat floor (the Veneti's) instead of a round bilge
 */
export function shapePoint(h, t, f) {
  const u = 2 * t - 1;
  const [pf, ef] = h.fore;
  const [pa, ea] = h.aft;
  const hb = (h.B / 2) * (u > 0 ? Math.max(0, 1 - u ** pf) ** ef : Math.max(0, 1 - (-u) ** pa) ** ea);
  const yk = h.keelAft * ((Math.max(0, 0.2 - t) / 0.2) ** 1.6) + h.keelFore * ((Math.max(0, t - 0.82) / 0.18) ** 1.8);
  const ys = h.D + h.sheerAft * (1 - t) ** 3.2 + h.sheerFore * t ** 3.4;
  const sharp = Math.max(smooth(h.sharpAft, 0.0, t), smooth(h.sharpFore, 1.0, t));
  const a = (f * Math.PI) / 2;
  // A round bilge, or (flat) a flat floor turning up hard into near-straight sides.
  const xr0 = Math.sin(a) ** 0.85;
  const yr0 = 1 - Math.cos(a);
  const xf = Math.min(1, f * 2.2) ** 0.7;
  const yf = Math.max(0, (f - 0.25) / 0.75) ** 1.1;
  const xr = xr0 + (xf - xr0) * (h.flat || 0);
  const yr = yr0 + (yf - yr0) * (h.flat || 0);
  const x = hb * (xr + (f - xr) * sharp);
  const y = yk + (ys - yk) * (yr + (f ** 1.15 - yr) * sharp);
  return [x, y, (t - 0.5) * (h.L - 0.7)];
}

/** The liburnian's own hull (models/harbour.js), for the same calls as shapePoint. */
function libPoint(h, t, f) {
  return liburnianPoint(t, f);
}

/** A design's hull point (t, f): its own shape or the Navalia's liburnian's. */
export function hullAt(d, t, f) {
  return d.hull.of === 'liburnian' ? libPoint(d.hull, t, f) : shapePoint(d.hull, t, f);
}

/** The t (0 stern to 1 bow) of a point `z` metres along the hull. */
export function tAt(d, z) {
  return z / (d.hull.L - 0.7) + 0.5;
}

/**
 * The benches of an oared design: where each rower's thole is (the pivot his
 * sweep turns on, on the gunwale or in a port: ROW_SHIP's thole) on side s
 * (+1 starboard), and where he sits, so his clip's thole lands on it. A
 * rower faces the stern (-z); his left is then -x, so the starboard side
 * rows with the sweep on his right (rowShipRight), port on his left
 * (rowShip). In the hull's frame before the draft (keel at 0).
 */
export function benches(d) {
  const r = d.rowers;
  if (!r) return [];
  const out = [];
  for (let k = 0; k < r.n; k++) {
    for (const s of [1, -1]) {
      // (Staggered on a narrow hull: port's benches half a step aft of starboard's.)
      const t = r.t0 + ((r.t1 - r.t0) * (k + 0.5)) / r.n - (r.stagger && s < 0 ? (r.t1 - r.t0) / r.n / 2 : 0);
      const p = hullAt(d, t, r.f);
      const thole = [s * (p[0] + r.out), p[1] + r.up, p[2]];
      // His feet: ROW_SHIP.out inboard of the thole (along x), ROW_SHIP.up under it, ROW_SHIP.ahead toward the bow.
      const at = [thole[0] - s * ROW_SHIP.out, thole[1] - ROW_SHIP.up, thole[2] + ROW_SHIP.ahead];
      out.push({ k, s, t, thole, at, clip: s > 0 ? 'rowShipRight' : 'rowShip' });
    }
  }
  return out;
}

/**
 * Every kind of vessel. `hull` the shape (shapePoint, or `of: 'liburnian'`);
 * `draft` the waterline over the keel; `deck` the deck's girth f (its height
 * follows the sheer); `masts` each { t, h over the deck, rake (rad toward
 * the bow), yard (along the mast), sail: { w, h, shape 'square' | 'lateen',
 * belly }, }; `rowers` { n a side, t0..t1, f the girth their tholes ride
 * at, `out`/`up` from that point, stagger }; `lantern` [x, y, z]; `rudders`
 * the steering oars' t and girth; `paint` colours (sRGB hex) for the hull;
 * `crewMax` how many ride aboard at most (look.js).
 */
export const DESIGNS = Object.freeze({
  corbita: Object.freeze({
    name: 'Corbita (merchantman)',
    hull: Object.freeze({ L: 7.6, B: 2.5, D: 1.5, sheerAft: 0.62, sheerFore: 0.36, aft: [2.4, 0.5], fore: [2.2, 0.62], keelAft: 0.45, keelFore: 0.3, sharpAft: 0.18, sharpFore: 0.78, flat: 0 }),
    draft: 0.86,
    deck: 0.93,
    masts: Object.freeze([
      Object.freeze({ t: 0.56, h: 5.3, rake: 0, yard: 4.95, sail: Object.freeze({ w: 4.6, h: 3.5, shape: 'square', belly: 0.55 }) }),
      Object.freeze({ t: 0.93, h: 2.3, rake: 0.72, yard: 2.15, sail: Object.freeze({ w: 1.6, h: 1.15, shape: 'square', belly: 0.25 }) }),
    ]),
    rudders: Object.freeze({ t: 0.1, f: 0.95, both: true }),
    lantern: Object.freeze([0, 0, -3.62]),
    paint: Object.freeze({ band: 0x2f5f8a, wale: 0x3a2a1e, trim: 0xd8c27a }),
  }),
  coaster: Object.freeze({
    name: 'Coaster',
    hull: Object.freeze({ L: 5.2, B: 1.95, D: 1.08, sheerAft: 0.42, sheerFore: 0.3, aft: [2.3, 0.55], fore: [2.1, 0.62], keelAft: 0.3, keelFore: 0.22, sharpAft: 0.2, sharpFore: 0.76, flat: 0 }),
    draft: 0.58,
    deck: 0.92,
    masts: Object.freeze([
      Object.freeze({ t: 0.56, h: 3.7, rake: 0, yard: 3.45, sail: Object.freeze({ w: 3.2, h: 2.45, shape: 'square', belly: 0.4 }) }),
    ]),
    rudders: Object.freeze({ t: 0.1, f: 0.96, both: false }),
    lantern: Object.freeze([0, 0, -2.45]),
    paint: Object.freeze({ band: 0x8a3b2a, wale: 0x3e2c20, trim: 0xc9b07a }),
  }),
  liburnian: Object.freeze({
    name: 'Liburnian',
    hull: Object.freeze({ of: 'liburnian', L: LIBURNIAN.L, B: LIBURNIAN.B, D: LIBURNIAN.D }),
    draft: 0.38,
    deck: 0.97,
    masts: Object.freeze([
      Object.freeze({ t: 0.6, h: 4.0, rake: 0, yard: 3.7, sail: Object.freeze({ w: 3.3, h: 2.5, shape: 'square', belly: 0.42 }) }),
    ]),
    // The upper bank: its oars out of the oar box's ports (models/harbour.js: the box at the
    // sheer's f 0.94, its face 0.23 out), the lower bank's ports closed.
    rowers: Object.freeze({ n: 7, t0: 0.27, t1: 0.79, f: 0.94, out: 0.225, up: 0.02, stagger: false }),
    rudders: Object.freeze({ t: 0.12, f: 1, both: true }),
    lantern: Object.freeze([0, 0, -3.9]),
    paint: Object.freeze({ band: 0x9e3426, wale: 0x3a2a1e, trim: 0xc9973c }),
  }),
  lembos: Object.freeze({
    name: 'Lembos (pirate galley)',
    hull: Object.freeze({ L: 6.6, B: 1.55, D: 0.74, sheerAft: 0.5, sheerFore: 0.3, aft: [2.0, 0.5], fore: [2.6, 0.7], keelAft: 0.35, keelFore: 0.08, sharpAft: 0.3, sharpFore: 0.66, flat: 0 }),
    draft: 0.36,
    deck: 0.9,
    masts: Object.freeze([
      Object.freeze({ t: 0.56, h: 3.1, rake: 0, yard: 2.85, sail: Object.freeze({ w: 2.7, h: 2.0, shape: 'square', belly: 0.36 }) }),
    ]),
    rowers: Object.freeze({ n: 5, t0: 0.24, t1: 0.82, f: 1, out: 0.03, up: 0.04, stagger: true }),
    rudders: Object.freeze({ t: 0.08, f: 0.98, both: false }),
    lantern: Object.freeze([0, 0, -3.1]),
    paint: Object.freeze({ band: 0x5a3a24, wale: 0x1e1814, trim: 0x8a6a44, sail: 0xa88a62 }),
  }),
  punic: Object.freeze({
    name: 'Punic galley',
    hull: Object.freeze({ L: 7.2, B: 1.6, D: 0.8, sheerAft: 0.6, sheerFore: 0.22, aft: [2.1, 0.5], fore: [2.5, 0.66], keelAft: 0.42, keelFore: 0.04, sharpAft: 0.3, sharpFore: 0.62, flat: 0 }),
    draft: 0.42,
    deck: 0.92,
    masts: Object.freeze([
      Object.freeze({ t: 0.58, h: 3.6, rake: 0, yard: 3.35, sail: Object.freeze({ w: 3.0, h: 2.2, shape: 'square', belly: 0.4 }) }),
    ]),
    rowers: Object.freeze({ n: 6, t0: 0.24, t1: 0.8, f: 1, out: 0.03, up: 0.0, stagger: true }),
    rudders: Object.freeze({ t: 0.08, f: 0.98, both: true }),
    lantern: Object.freeze([0, 0, -3.5]),
    paint: Object.freeze({ band: 0x5b1e3c, wale: 0x14110f, trim: 0xc9a14a, sail: 0xd9cdb0 }),
  }),
  gaulish: Object.freeze({
    name: 'Venetic ship (Gauls)',
    hull: Object.freeze({ L: 6.8, B: 2.15, D: 1.32, sheerAft: 0.72, sheerFore: 0.78, aft: [3.2, 0.42], fore: [3.0, 0.42], keelAft: 0.35, keelFore: 0.35, sharpAft: 0.12, sharpFore: 0.88, flat: 0.85 }),
    draft: 0.6,
    deck: 0.9,
    masts: Object.freeze([
      Object.freeze({ t: 0.54, h: 3.7, rake: 0, yard: 3.4, sail: Object.freeze({ w: 3.0, h: 2.5, shape: 'square', belly: 0.34 }) }),
    ]),
    // A few sweeps through ports in the high side, for the calms and the shallows.
    rowers: Object.freeze({ n: 3, t0: 0.3, t1: 0.74, f: 0.8, out: 0.02, up: 0, stagger: false, ports: true }),
    rudders: Object.freeze({ t: 0.06, f: 0.98, both: false }),
    lantern: Object.freeze([0, 0, -3.3]),
    paint: Object.freeze({ band: 0x4a3a28, wale: 0x2a2018, trim: 0x8a7050, sail: 0x7a5434 }),
  }),
  fishing: Object.freeze({
    name: 'Fishing boat',
    hull: Object.freeze({ L: 4.2, B: 1.55, D: 0.72, sheerAft: 0.24, sheerFore: 0.3, aft: [2.0, 0.6], fore: [2.2, 0.66], keelAft: 0.2, keelFore: 0.18, sharpAft: 0.22, sharpFore: 0.72, flat: 0 }),
    draft: 0.34,
    deck: 0.9,
    masts: Object.freeze([
      Object.freeze({ t: 0.66, h: 2.5, rake: 0.05, yard: 2.35, sail: Object.freeze({ w: 2.4, h: 1.9, shape: 'lateen', belly: 0.3 }) }),
    ]),
    rowers: Object.freeze({ n: 1, t0: 0.38, t1: 0.66, f: 1, out: 0.03, up: 0.03, stagger: true }),
    rudders: Object.freeze({ t: 0.06, f: 0.98, both: false }),
    lantern: Object.freeze([0, 0, -1.85]),
    paint: Object.freeze({ band: 0x3f6f8f, wale: 0x3a2a1e, trim: 0xd6c39a }),
  }),
});

/** Every kind's name, in the lab's order. */
export const KINDS = Object.freeze(Object.keys(DESIGNS));

/** The deck's height (hull frame, keel at 0) at t: the sheer's at the design's deck girth. */
export function deckY(d, t) {
  return hullAt(d, t, d.deck)[1];
}

/** A mast's foot (on the deck or the keelson; the hull frame, keel at 0) and its direction (raked toward the bow). */
export function mastOf(d, i) {
  const m = d.masts[i];
  const z = (m.t - 0.5) * (d.hull.L - 0.7);
  return { foot: [0, deckY(d, m.t), z], dir: [0, Math.cos(m.rake), Math.sin(m.rake)] };
}

/** Where a mast's yard hangs (hull frame): `yard` metres up the mast from its foot. */
export function yardAt(d, i) {
  const { foot, dir } = mastOf(d, i);
  const y = d.masts[i].yard;
  return [foot[0] + dir[0] * y, foot[1] + dir[1] * y, foot[2] + dir[2] * y];
}

/** The hull's half-length and half-beam (m): how far it reaches from its middle (a mooring's clearance, a click's reach). */
export function extentOf(d) {
  return { half: d.hull.L / 2 + 0.25, beam: d.hull.B / 2 + (d.rowers ? 0.2 : 0.05) };
}
