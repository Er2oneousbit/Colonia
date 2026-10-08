/**
 * models/numina.js
 * ----------------------------------------------------------------------------
 * The five gods as the temples of the 3D look show them (aedes.js the small
 * temple, templum.js the grand one): each god's order, colours and
 * dedication, the emblems on the gable's top and corners (acroteria) and
 * in the pediment, the things left at the altar, and the cult statue in
 * the cella, after the record:
 *
 *   ceres    Her temple on the Aventine (493 BC) was built in the Tuscan
 *            way, wide-spaced columns under a wooden entablature, its
 *            pediment and roof dressed in painted terracotta (Vitruvius
 *            III.3 names it araeostyle). Ceres holds ears of wheat and a
 *            torch (she searched for Proserpina by torchlight), her head
 *            veiled; a sow was her sacrifice, the plough and the sheaf her
 *            gifts. Here: Tuscan columns, a red-ochre pediment with a gilt
 *            sheaf between torches, terracotta palmettes, sheaves leaning
 *            at the altar and a plough by the steps.
 *   neptune  Rome's temple of Neptune in the Circus Flaminius had his
 *            marine retinue (Scopas's group of Neptune, Thetis, Achilles,
 *            Nereids on dolphins and hippocamps, Pliny XXXVI.26). Here:
 *            Ionic columns (the order of the Greek coast), a sea-blue
 *            pediment with a gilt trident between dolphins, a wave scroll
 *            painted on a blue-green frieze, bronze dolphins at the
 *            corners, an anchor given by a ship's crew by the steps; the
 *            god enthroned with his trident and a dolphin.
 *   mercury  The god of trade had his temple by the Circus Maximus, where
 *            the merchants were (495 BC), and his feast on the Ides of
 *            May. His signs: the caduceus (the herald's staff of two
 *            snakes and wings), the winged hat (petasus), the purse, the
 *            rooster that heralds the day, the herm at the crossroads.
 *            Here: Corinthian, a green pediment with the caduceus between
 *            roosters, winged hats at the corners, a herm by the altar;
 *            the young god with his purse and caduceus, his cloak over his
 *            shoulder.
 *   mars     Augustus's temple of Mars Ultor (the Avenger, 2 BC), of
 *            Carrara marble, Corinthian, held the god in his cuirass and
 *            helmet with spear and shield; the standards won back from
 *            Parthia were kept in it. Here: Corinthian, a crimson
 *            pediment with a gilt trophy (a helmet over a shield and
 *            crossed spears) between round shields, a crested helmet on
 *            the gable, shields on the corners, a bronze trophy by the
 *            steps; the god armed, helmeted.
 *   venus    Caesar's Venus Genetrix (46 BC) in his forum, Corinthian, of
 *            pale marble, the goddess in a clinging chiton lifting her
 *            mantle from her shoulder (Arcesilaus's statue). Her signs:
 *            the scallop shell she rose from, the dove, myrtle and roses.
 *            Here: Corinthian, a pale blue pediment with a gilt shell
 *            between doves, doves on the corners, myrtles and roses in
 *            pots by the steps.
 *
 * Builders return geometries by material key (gilt, bronze, marble,
 * terracotta, wood, iron, paint, leaf, flowers), standing on y 0 or
 * centred as each says, facing +z, in metres.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, ConeGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { artRng, smoothstep } from '../texgen.js';
import { lin, D } from './rural.js';
import { box } from './castra.js';
import { figure, head, loft, ellipsoid, member, skirt, drape, torso, arm, leg, hand } from './statuary.js';
import { Vector3 } from 'three';

/** The five gods, in the game's order (data/buildings.js). */
export const GODS = Object.freeze(['ceres', 'neptune', 'mercury', 'mars', 'venus']);

/**
 * Each god's temple: its order, the colours of its pediment's ground, its
 * frieze and the frieze's pattern, the dedication cut in the frieze (in the
 * dative: "to Ceres"), what its acroteria are made of.
 */
export const NUMEN = Object.freeze({
  ceres: Object.freeze({ order: 'tuscan', ground: lin(0x9a4022, 1.1), frieze: lin(0xc89032, 1.1), trim: lin(0x3f6a2c, 1.2), dedication: 'CERERI', acro: 'terracotta' }),
  neptune: Object.freeze({ order: 'ionic', ground: lin(0x1f5a80, 1.15), frieze: lin(0x2a7a76, 1.15), trim: lin(0xe8e4da), dedication: 'NEPTVNO', acro: 'gilt' }),
  mercury: Object.freeze({ order: 'corinthian', ground: lin(0x2c5c3e, 1.15), frieze: lin(0xc8a040, 1.1), trim: lin(0x6e1a3c, 1.2), dedication: 'MERCVRIO', acro: 'gilt' }),
  mars: Object.freeze({ order: 'corinthian', ground: lin(0x8c1c14, 1.2), frieze: lin(0x5a1a14, 1.2), trim: lin(0xd8a84a), dedication: 'MARTI·VLTORI', acro: 'gilt' }),
  venus: Object.freeze({ order: 'corinthian', ground: lin(0x86a8c8, 1.1), frieze: lin(0xdca6a0, 1.05), trim: lin(0xf2ece0), dedication: 'VENERI·GENETRICI', acro: 'marble' }),
});

/** Geometry lists by material key. */
export function emblemBins() {
  return { gilt: [], bronze: [], marble: [], terracotta: [], wood: [], iron: [], paint: [], leaf: [], flowers: [], cloth: [], straw: [] };
}

const v3 = (a) => new Vector3(a[0], a[1], a[2]);

/** Move every geometry of bins `b` by (x, y, z), turned ry about y and scaled s first; returns b. */
export function placeBins(b, x, y, z, { ry = 0, s = 1, rx = 0 } = {}) {
  for (const list of Object.values(b)) {
    for (const g of list) {
      if (s !== 1) g.scale(s, s, s);
      if (rx) g.rotateX(rx);
      if (ry) g.rotateY(ry);
      g.translate(x, y, z);
    }
  }
  return b;
}

/** Pour bins `from` into bins `to` (by key; a key `to` lacks goes to `to[fallback]`). */
export function pourBins(from, to, fallback = 'marble') {
  for (const [k, list] of Object.entries(from)) (to[k] || to[fallback]).push(...list);
  return to;
}

// ---------------------------------------------------------------------------
// Emblems (centred on x = 0, standing on y 0, facing +z, about 1 m tall)
// ---------------------------------------------------------------------------

/** A sheaf of wheat bound at its waist, the ears fanning out at the top: `key` its material. */
export function wheatSheaf(lod = 0, key = 'gilt', seed = 3) {
  const b = emblemBins();
  const rnd = artRng(seed);
  const n = lod === 2 ? 5 : lod ? 9 : 17;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd() * 0.4;
    const spread = 0.05 + rnd() * 0.12;
    const top = [Math.sin(a) * spread * 1.6, 0.95 + rnd() * 0.1, Math.cos(a) * spread];
    const foot = [Math.sin(a) * spread * 0.9, 0, Math.cos(a) * spread * 0.6];
    const waist = [Math.sin(a) * 0.035, 0.42, Math.cos(a) * 0.03];
    b[key].push(tube([foot, waist, top], 0.008, { radial: 3, segments: lod ? 3 : 6, around: 0.1 }));
    if (lod < 2) {
      const ear = new SphereGeometry(0.025, 5, 3);
      ear.scale(0.8, 2.6, 0.8);
      ear.translate(top[0] * 1.05, top[1] + 0.05, top[2] * 1.05);
      b[key].push(tintGeometry(boxUV(ear)));
    }
  }
  // The band round its waist.
  const band = new TorusGeometry(0.06, 0.016, 4, lod ? 8 : 14);
  band.rotateX(Math.PI / 2);
  band.translate(0, 0.42, 0);
  b[key].push(tintGeometry(boxUV(band), () => 0.85));
  return b;
}

/** A torch: a shaft, the bowl, its flame of gilt (the sculptor's fire), `h` tall. */
export function torch(lod = 0, key = 'gilt', h = 1) {
  const b = emblemBins();
  b[key].push(tintGeometry(boxUV(new CylinderGeometry(0.018, 0.025, h * 0.78, lod ? 5 : 8, 1).translate(0, h * 0.39, 0))));
  b[key].push(revolve(profileOf([[0.025, h * 0.76], [0.07, h * 0.82], [0.075, h * 0.85], [0, h * 0.85]]), { segments: lod ? 6 : 10, metres: 0.3 }));
  const f = revolve(profileOf([[0, h * 0.84], [0.06, h * 0.86], [0.05, h * 0.92], [0.02, h * 0.98], [0, h]]), { segments: lod ? 6 : 10, metres: 0.3 });
  if (lod === 0) {
    const P = f.attributes.position;
    for (let i = 0; i < P.count; i++) P.setX(i, P.getX(i) + 0.03 * Math.sin(P.getY(i) * 40));
    f.computeVertexNormals();
  }
  b[key].push(f);
  return b;
}

/** Neptune's trident: a shaft and three barbed prongs, `h` tall. */
export function trident(lod = 0, key = 'gilt', h = 1) {
  const b = emblemBins();
  const r = 0.014 * h;
  b[key].push(tintGeometry(boxUV(new CylinderGeometry(r, r * 1.2, h * 0.78, lod ? 5 : 8, 1).translate(0, h * 0.39, 0))));
  b[key].push(box(0.2 * h, 0.03 * h, 0.03 * h, 0, h * 0.77, 0));
  for (const s of [-1, 0, 1]) {
    const x = s * 0.09 * h;
    b[key].push(tube([[x, h * 0.78, 0], [x * 1.05, h * 0.92, 0], [x * (s ? 0.92 : 1), h, 0]], r * 0.8, { radial: lod ? 3 : 5, segments: 3, around: 0.1 }));
    if (lod < 2) {
      const tip = new ConeGeometry(r * 2.2, 0.08 * h, lod ? 3 : 4);
      tip.translate(x * (s ? 0.92 : 1), h + 0.03 * h, 0);
      b[key].push(tintGeometry(boxUV(tip)));
    }
  }
  return b;
}

/** A dolphin leaping, nose to the left (-x) at its middle's height `h/2`, `L` long: an arched body, its flukes, fins. */
export function dolphin(lod = 0, key = 'bronze', L = 1, { dive = 1 } = {}) {
  const b = emblemBins();
  const pts = [];
  const n = lod ? 5 : 9;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    // The arch: up from the snout, over the back, down to the tail curling up again.
    pts.push([(-0.5 + t) * L, (Math.sin(Math.PI * t) * 0.32 - 0.12 * Math.sin(Math.PI * t * 2.2) * t) * L * dive, 0]);
  }
  b[key].push(member(pts.map(v3), 0.09 * L, 0.025 * L, { radial: lod === 2 ? 5 : lod ? 7 : 10, segs: lod ? 6 : 12, bulge: 0.04 * L, at: 0.3, wide: 0.25 }));
  // The beak, the dorsal fin, the flukes.
  const [sx, sy] = pts[0];
  b[key].push(member([v3([sx, sy, 0]), v3([sx - 0.12 * L, sy - 0.04 * L, 0])], 0.03 * L, 0.012 * L, { radial: lod ? 5 : 7, segs: 2 }));
  if (lod < 2) {
    const fin = new ConeGeometry(0.06 * L, 0.14 * L, 4);
    fin.scale(1, 1, 0.3);
    fin.rotateZ(0.5);
    const top = pts[Math.round(n * 0.45)];
    fin.translate(top[0], top[1] + 0.1 * L, 0);
    b[key].push(tintGeometry(boxUV(fin)));
    const [tx, ty] = pts[n];
    for (const s of [-1, 1]) {
      const fl = new SphereGeometry(0.06 * L, 6, 3);
      fl.scale(1.6, 0.25, 0.8);
      fl.rotateZ(0.6);
      fl.rotateX(s * 0.5);
      fl.translate(tx + 0.04 * L, ty + 0.04 * L, s * 0.05 * L);
      b[key].push(tintGeometry(boxUV(fl)));
    }
  }
  return b;
}

/** Mercury's caduceus: a staff, two snakes wound round it facing each other at its top, and wings, `h` tall. */
export function caduceus(lod = 0, key = 'gilt', h = 1) {
  const b = emblemBins();
  b[key].push(tintGeometry(boxUV(new CylinderGeometry(0.015 * h, 0.02 * h, h * 0.95, lod ? 5 : 8, 1).translate(0, h * 0.475, 0))));
  b[key].push(tintGeometry(boxUV(new SphereGeometry(0.035 * h, lod ? 6 : 10, lod ? 4 : 6).translate(0, h * 0.97, 0))));
  for (const s of [-1, 1]) {
    const pts = [];
    const n = lod === 2 ? 6 : lod ? 12 : 24;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const a = t * Math.PI * 3 + (s > 0 ? Math.PI : 0);
      const r = 0.06 * h * (1 - 0.3 * t);
      pts.push([Math.sin(a) * r, h * (0.2 + 0.62 * t), Math.cos(a) * r * 0.6]);
    }
    // The heads turned in toward each other over the staff's top.
    pts.push([s * 0.07 * h, h * 0.86, 0.02 * h], [s * 0.035 * h, h * 0.88, 0.04 * h]);
    b[key].push(tube(pts, 0.011 * h, { radial: lod ? 4 : 5, segments: n + 4, around: 0.1 }));
    if (lod < 2) {
      // A wing either side at the top: a fan of feathers.
      const wing = new SphereGeometry(0.1 * h, 8, 4, 0, Math.PI);
      wing.scale(1.1, 0.5, 0.12);
      wing.rotateZ(s * 0.5 - (s < 0 ? Math.PI : 0));
      wing.translate(s * 0.075 * h, h * 0.9, 0);
      b[key].push(tintGeometry(boxUV(wing)));
    }
  }
  return b;
}

/** The winged hat (petasus): a round crown, a broad brim, a wing either side. `s` its brim's width. */
export function petasus(lod = 0, key = 'gilt', s = 0.5) {
  const b = emblemBins();
  b[key].push(tintGeometry(boxUV(new CylinderGeometry(s / 2, s / 2, s * 0.04, lod ? 10 : 18, 1).translate(0, s * 0.02, 0))));
  b[key].push(tintGeometry(boxUV(new SphereGeometry(s * 0.22, lod ? 8 : 14, lod ? 4 : 7, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, s * 0.03, 0))));
  for (const k of [-1, 1]) {
    const w = new SphereGeometry(s * 0.24, 8, 4, 0, Math.PI);
    w.scale(1.2, 0.6, 0.1);
    w.rotateY(Math.PI / 2);
    w.rotateZ(k * 0.35);
    w.rotateY(-Math.PI / 2);
    w.translate(k * s * 0.22, s * 0.2, 0);
    b[key].push(tintGeometry(boxUV(w)));
  }
  return b;
}

/** A rooster, facing +x (turned by the caller), standing on y 0, about `s` tall. */
export function rooster(lod = 0, key = 'gilt', s = 0.5) {
  const b = emblemBins();
  const seg = lod ? 8 : 12;
  b[key].push(ellipsoid(s * 0.22, 1.3, 1, 0.8, 0, s * 0.42, 0, seg, seg - 2));
  b[key].push(member([v3([s * 0.18, s * 0.5, 0]), v3([s * 0.24, s * 0.72, 0]), v3([s * 0.26, s * 0.84, 0])], s * 0.07, s * 0.06, { radial: lod ? 5 : 7, segs: 3 }));
  b[key].push(ellipsoid(s * 0.07, 1.1, 1, 0.9, s * 0.27, s * 0.88, 0, seg, seg - 2));
  if (lod < 2) {
    // The comb, the beak, the wattle; the tail's sickle feathers; the legs.
    b[key].push(box(s * 0.1, s * 0.07, s * 0.02, s * 0.26, s * 0.93, 0));
    const beak = new ConeGeometry(s * 0.025, s * 0.07, 4);
    beak.rotateZ(-Math.PI / 2);
    beak.translate(s * 0.35, s * 0.87, 0);
    b[key].push(tintGeometry(boxUV(beak)));
    for (let k = 0; k < 3; k++) {
      b[key].push(tube([[-s * 0.2, s * 0.5, (k - 1) * s * 0.03], [-s * 0.38, s * (0.75 + k * 0.05), (k - 1) * s * 0.04], [-s * 0.45, s * (0.6 + k * 0.08), (k - 1) * s * 0.05]], s * 0.025, { radial: 3, segments: 5, around: 0.1 }));
    }
    for (const z of [-1, 1]) b[key].push(box(s * 0.025, s * 0.25, s * 0.025, 0, 0, z * s * 0.06));
  }
  return b;
}

/** A crested helmet (the Corinthian helmet a Roman Mars wears pushed back on his head), on y 0, about `s` tall. */
export function helmet(lod = 0, key = 'gilt', s = 0.6) {
  const b = emblemBins();
  const seg = lod ? 10 : 18;
  b[key].push(revolve(profileOf([[s * 0.24, 0], [s * 0.26, s * 0.08], [s * 0.27, s * 0.22], [s * 0.24, s * 0.36], [s * 0.15, s * 0.46], [0, s * 0.5]]), { segments: seg, metres: 0.5 }));
  // The crest: a ridge of horsehair from the brow over to the nape.
  const pts = [];
  for (let k = 0; k <= 8; k++) {
    const a = D(-75 + k * 21);
    pts.push([0, s * 0.42 + Math.cos(a) * s * 0.18, Math.sin(a) * s * 0.3]);
  }
  b[key === 'gilt' ? 'paint' : key].push(tintGeometry(tube(pts, s * 0.06, { radial: lod ? 4 : 6, segments: lod ? 6 : 12, around: 0.1 }), () => lin(0xa8221a)));
  b[key].push(box(s * 0.04, s * 0.12, s * 0.65, 0, s * 0.46, 0, 0.9));
  if (lod < 2) {
    // The cheek pieces and the nose guard.
    for (const k of [-1, 1]) b[key].push(box(s * 0.04, s * 0.22, s * 0.16, k * s * 0.23, -s * 0.12, s * 0.12, 0.92));
    b[key].push(box(s * 0.04, s * 0.14, s * 0.03, 0, -s * 0.06, s * 0.26, 0.92));
  }
  return b;
}

/** A round shield (clipeus) in the x-y plane, facing +z, its middle at the origin, `r` its radius. */
export function clipeus(lod = 0, key = 'gilt', r = 0.4) {
  const b = emblemBins();
  const seg = lod === 2 ? 10 : lod ? 16 : 28;
  const disc = revolve(profileOf([[r, 0], [r, r * 0.04], [r * 0.92, r * 0.07], [r * 0.3, r * 0.1], [r * 0.22, r * 0.18], [0, r * 0.22]]), { segments: seg, metres: 0.6, tint: (p) => (Math.hypot(p.x, p.z) > r * 0.88 ? 1 : 0.88) });
  disc.rotateX(Math.PI / 2);
  b[key].push(disc);
  if (lod === 0) {
    const rim = new TorusGeometry(r * 0.95, r * 0.035, 4, seg);
    rim.translate(0, 0, r * 0.05);
    b[key].push(tintGeometry(boxUV(rim)));
  }
  return b;
}

/** A trophy (tropaeum): the spoils of a beaten enemy hung on a post, a helmet on top, a shield, crossed spears; `h` tall. */
export function trophy(lod = 0, key = 'bronze', h = 1.6) {
  const b = emblemBins();
  b.wood.push(box(0.08, h * 0.82, 0.08, 0, 0, 0, 0.6));
  b.wood.push(box(h * 0.42, 0.06, 0.06, 0, h * 0.62, 0, 0.6));
  // The cuirass hung on the post, its shoulder flaps on the cross-bar.
  b[key].push(loft([[h * 0.36, 0, 0.01, h * 0.11, h * 0.07], [h * 0.46, 0, 0.012, h * 0.1, h * 0.065], [h * 0.56, 0, 0.012, h * 0.115, h * 0.07], [h * 0.64, 0, 0, h * 0.12, h * 0.06]], { seg: lod ? 10 : 18 }));
  if (lod < 2) for (let k = -3; k <= 3; k++) b[key].push(box(h * 0.03, h * 0.08, h * 0.012, k * h * 0.032, h * 0.29, h * 0.07, 0.85));
  pourBins(placeBins(helmet(lod, key, h * 0.24), 0, h * 0.71, 0), b);
  pourBins(placeBins(clipeus(lod, key, h * 0.17), -h * 0.17, h * 0.5, h * 0.09, { ry: 0.25 }), b);
  // Two spears crossed behind it.
  for (const s of [-1, 1]) {
    b.wood.push(tube([[s * h * 0.28, 0.02, -0.05], [-s * h * 0.22, h * 1.0, -0.05]], 0.012, { radial: 4, segments: 2, around: 0.1 }));
    if (lod < 2) b.iron.push(tintGeometry(boxUV(new ConeGeometry(0.03, 0.14, 4).rotateZ(s * 0.46).translate(-s * h * 0.25, h * 1.04, -0.05))));
  }
  return b;
}

/** A scallop shell standing on its hinge, facing +z: a fan of ribs, `r` across its half. */
export function shell(lod = 0, key = 'gilt', r = 0.4) {
  const b = emblemBins();
  const ribs = lod === 2 ? 6 : lod ? 10 : 16;
  const rows = lod ? 3 : 6;
  const pos = [];
  const P = (u, v) => {
    // u across the fan (0..1 from one ear to the other), v out from the hinge.
    const a = Math.PI * (0.05 + 0.9 * u);
    const rib = lod === 2 ? 0 : 0.06 * Math.abs(Math.sin(u * ribs * Math.PI));
    const rr = r * (0.12 + 0.88 * v);
    return [-Math.cos(a) * rr, Math.sin(a) * rr, (0.15 * Math.sin(Math.PI * v) + rib * v) * r];
  };
  const cols = ribs * 2;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const a = P(i / cols, j / rows);
      const bb = P((i + 1) / cols, j / rows);
      const c = P((i + 1) / cols, (j + 1) / rows);
      const d = P(i / cols, (j + 1) / rows);
      pos.push(...a, ...bb, ...c, ...a, ...c, ...d);
      pos.push(...a, ...c, ...bb, ...a, ...d, ...c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  b[key].push(tintGeometry(boxUV(g), (x, y) => 0.85 + 0.15 * Math.min(1, y / r)));
  // The hinge's two ears.
  b[key].push(box(r * 0.36, r * 0.12, r * 0.05, 0, -r * 0.02, 0, 0.9));
  return b;
}

/** A dove: a plump body, head and beak, folded wings, a fan tail; facing +x, standing on y 0, `s` long. */
export function dove(lod = 0, key = 'marble', s = 0.3, { flying = false } = {}) {
  const b = emblemBins();
  const seg = lod ? 7 : 11;
  b[key].push(ellipsoid(s * 0.3, 1.5, 0.9, 0.85, 0, s * 0.3, 0, seg, seg - 2));
  b[key].push(ellipsoid(s * 0.13, 1, 1, 0.95, s * 0.42, s * 0.48, 0, seg, seg - 2));
  if (lod < 2) {
    const beak = new ConeGeometry(s * 0.03, s * 0.1, 4);
    beak.rotateZ(-Math.PI / 2);
    beak.translate(s * 0.58, s * 0.47, 0);
    b[key].push(tintGeometry(boxUV(beak)));
    const tail = new SphereGeometry(s * 0.18, 6, 3);
    tail.scale(1.4, 0.25, 0.9);
    tail.translate(-s * 0.48, s * 0.36, 0);
    b[key].push(tintGeometry(boxUV(tail)));
    for (const k of [-1, 1]) {
      const w = new SphereGeometry(s * 0.26, 7, 3);
      w.scale(1.3, 0.25, flying ? 1.9 : 0.5);
      if (flying) w.rotateX(k * 0.5);
      w.translate(-s * 0.05, s * (flying ? 0.5 : 0.36), k * s * (flying ? 0.32 : 0.16));
      b[key].push(tintGeometry(boxUV(w)));
    }
  }
  return b;
}

/** Mercury's purse (marsupium): a round bag tied at its neck. */
export function purse(lod = 0, key = 'gilt', s = 0.25) {
  const b = emblemBins();
  b[key].push(revolve(profileOf([[0, 0], [s * 0.35, s * 0.08], [s * 0.42, s * 0.35], [s * 0.3, s * 0.62], [s * 0.12, s * 0.75], [s * 0.14, s * 0.85], [s * 0.18, s * 0.95], [0, s * 0.93]]), { segments: lod ? 8 : 14, metres: 0.3 }));
  return b;
}

/** An anchor of iron with its wooden stock, standing on its crown, `h` tall. */
export function anchor(lod = 0, h = 1.4) {
  const b = emblemBins();
  b.iron.push(box(0.06, h * 0.9, 0.05, 0, 0.08, 0, 0.8));
  b.wood.push(box(h * 0.5, 0.08, 0.08, 0, h * 0.82, 0, 0.65));
  b.iron.push(tintGeometry(boxUV(new TorusGeometry(0.06, 0.015, 4, 10).translate(0, h + 0.02, 0))));
  // The arms curving up from the crown, flukes at their ends.
  for (const s of [-1, 1]) {
    b.iron.push(tube([[0, 0.12, 0], [s * h * 0.16, 0.1, 0], [s * h * 0.3, 0.3, 0]], 0.03, { radial: lod ? 4 : 6, segments: lod ? 4 : 8, around: 0.1 }));
    if (lod < 2) b.iron.push(box(0.12, 0.12, 0.03, s * h * 0.3, 0.28, 0, 0.8));
  }
  return b;
}

/** A wooden plough (the ard Ceres taught men to use): the beam, the share, the stilt. Lying along x. */
export function plough(lod = 0) {
  const b = emblemBins();
  b.wood.push(tube([[-0.9, 0.05, 0], [-0.2, 0.3, 0], [0.6, 0.62, 0]], 0.045, { radial: lod ? 4 : 6, segments: lod ? 3 : 6, around: 0.1 }));
  b.wood.push(box(0.6, 0.08, 0.1, -0.85, 0, 0, 0.6));
  b.iron.push(tintGeometry(boxUV(new ConeGeometry(0.06, 0.25, 4).rotateZ(Math.PI / 2).translate(-1.22, 0.04, 0))));
  b.wood.push(tube([[-0.6, 0.06, 0], [-0.75, 0.55, 0], [-0.7, 0.85, 0]], 0.03, { radial: lod ? 4 : 5, segments: 4, around: 0.1 }));
  return b;
}

// ---------------------------------------------------------------------------
// Each god's emblems: the gable's top and corners, the pediment
// ---------------------------------------------------------------------------

/**
 * The acroterion at the gable's apex (`where` 'apex') or a corner ('corner',
 * `side` -1 left or +1 right), standing on y 0, sized for a gable `w`
 * metres wide: each god's own. Returns bins.
 */
export function acroterion(god, where, lod = 0, w = 4.6, side = 1) {
  const s = w / 4.6;
  const key = NUMEN[god].acro;
  if (where === 'apex') {
    switch (god) {
      case 'ceres': return placeBins(wheatSheaf(lod, 'gilt'), 0, 0, 0, { s: 0.78 * s });
      case 'neptune': return placeBins(trident(lod, 'gilt', 0.95), 0, 0, 0, { s });
      case 'mercury': return placeBins(caduceus(lod, 'gilt', 1.05), 0, 0, 0, { s });
      case 'mars': return placeBins(helmet(lod, 'gilt', 0.6), 0, 0.12 * s, 0, { s });
      default: return placeBins(shell(lod, 'gilt', 0.38), 0, 0.1 * s, 0, { s });
    }
  }
  switch (god) {
    case 'ceres': {
      // A terracotta palmette (anthemion), as the Tuscan temples' roofs were dressed.
      const b = emblemBins();
      b.terracotta.push(...palmette(lod, 0.55 * s));
      return b;
    }
    case 'neptune': return placeBins(dolphin(lod, key, 0.75), 0, 0.28 * s, 0, { s, ry: side > 0 ? Math.PI : 0 });
    case 'mercury': return placeBins(petasus(lod, key, 0.42), 0, 0.02, 0, { s });
    case 'mars': return placeBins(clipeus(lod, key, 0.24), 0, 0.26 * s, 0, { s, ry: side * 0.6 });
    default: return placeBins(dove(lod, key, 0.38), 0, 0, 0, { s, ry: side > 0 ? Math.PI : 0 });
  }
}

/** A palmette (anthemion) standing on y 0: a fan of leaves over a pair of scrolls, `h` tall. */
export function palmette(lod = 0, h = 0.55) {
  const out = [];
  const n = lod === 2 ? 3 : lod ? 5 : 9;
  for (let k = 0; k < n; k++) {
    const a = D(-60 + (120 * k) / (n - 1));
    const leaf = new SphereGeometry(h * 0.16, lod ? 5 : 7, 3);
    leaf.scale(0.5, 2.4, 0.25);
    leaf.translate(0, h * 0.38, 0);
    leaf.rotateZ(a);
    leaf.translate(0, h * 0.18, 0);
    out.push(tintGeometry(boxUV(leaf), () => (k % 2 ? 0.85 : 1)));
  }
  if (lod < 2) {
    for (const s of [-1, 1]) {
      const sc = new TorusGeometry(h * 0.08, h * 0.025, 4, 10, Math.PI * 1.6);
      sc.translate(s * h * 0.12, h * 0.12, 0);
      out.push(tintGeometry(boxUV(sc)));
    }
  }
  out.push(box(h * 0.4, h * 0.06, h * 0.08, 0, 0, 0, 0.9));
  return out;
}

/**
 * What stands in a god's pediment, in relief against its painted ground:
 * the centrepiece and a pair either side facing it, in a gable `w` wide
 * and `h` high at its middle, its foot on y 0, standing out toward +z from
 * z 0; `centre` the centrepiece alone (a back pediment). Returns bins (the
 * reliefs in gilt).
 */
export function pedimentRelief(god, w, h, lod = 0, { centre = false } = {}) {
  const out = emblemBins();
  if (lod === 2) return out;
  const k = h / 0.8;
  const side = (fn) => {
    if (centre) return;
    for (const s of [-1, 1]) {
      const b = fn(s);
      pourBins(b, out);
    }
  };
  switch (god) {
    case 'ceres':
      // The sheaf in the middle; a torch either side laid along the slope (hers, that searched for
      // Proserpina); a lidded basket (cista) of the mysteries toward each corner.
      pourBins(placeBins(wheatSheaf(lod, 'gilt'), 0, 0.02, 0.05, { s: 0.6 * k }), out);
      side((s) => {
        const b = torch(lod, 'gilt', 0.62 * k);
        for (const g of b.gilt) g.rotateZ(-s * D(66));
        return placeBins(b, s * w * 0.14, 0.05, 0.05);
      });
      side((s) => {
        const b = emblemBins();
        b.gilt.push(revolve(profileOf([[0, 0], [0.13 * k, 0], [0.14 * k, 0.1 * k], [0.15 * k, 0.12 * k], [0.08 * k, 0.17 * k], [0, 0.18 * k]]), { segments: lod ? 8 : 14, metres: 0.3 }));
        return placeBins(b, s * w * 0.36, 0.02, 0.05);
      });
      break;
    case 'neptune':
      pourBins(placeBins(trident(lod, 'gilt', 0.78 * k), 0, 0.02, 0.05), out);
      side((s) => placeBins(dolphin(lod, 'gilt', 0.62 * k), s * w * 0.2, 0.14 * k, 0.06, { ry: s > 0 ? Math.PI : 0 }));
      side((s) => placeBins(dolphin(lod, 'gilt', 0.42 * k, { dive: 0.6 }), s * w * 0.36, 0.06 * k, 0.06, { ry: s > 0 ? Math.PI : 0 }));
      break;
    case 'mercury':
      pourBins(placeBins(caduceus(lod, 'gilt', 0.74 * k), 0, 0.02, 0.05), out);
      side((s) => placeBins(rooster(lod, 'gilt', 0.42 * k), s * w * 0.18, 0.02, 0.06, { ry: s > 0 ? Math.PI : 0 }));
      side((s) => placeBins(purse(lod, 'gilt', 0.24 * k), s * w * 0.33, 0.02, 0.06));
      break;
    case 'mars': {
      // A trophy of arms in the middle, round shields and crossed spears either side.
      pourBins(placeBins(trophy(lod, 'gilt', 0.78 * k), 0, 0.0, 0.05), out);
      side((s) => placeBins(clipeus(lod, 'gilt', 0.17 * k), s * w * 0.19, 0.2 * k, 0.04));
      side((s) => placeBins(helmet(lod, 'gilt', 0.24 * k), s * w * 0.33, 0.02, 0.06, { ry: s * 0.9 }));
      break;
    }
    default:
      pourBins(placeBins(shell(lod, 'gilt', 0.4 * k), 0, 0.04, 0.03), out);
      side((s) => placeBins(dove(lod, 'gilt', 0.32 * k, { flying: true }), s * w * 0.2, 0.18 * k, 0.07, { ry: s > 0 ? Math.PI : 0 }));
      side((s) => placeBins(dove(lod, 'gilt', 0.24 * k), s * w * 0.34, 0.02, 0.07, { ry: s > 0 ? Math.PI : 0 }));
  }
  // The wood of the trophy's post is gilt with the rest in a pediment (one sculptor's gilding).
  out.gilt.push(...out.wood.splice(0), ...out.iron.splice(0), ...out.bronze.splice(0), ...out.paint.splice(0), ...out.marble.splice(0));
  return out;
}

// ---------------------------------------------------------------------------
// The cult statues
// ---------------------------------------------------------------------------

/** A goddess's arm poses: [elbow, wrist, the hand's reach, its palm] for her right and left arms (her own frame). */
const POSES = {
  // Ceres: wheat ears held out low in her right hand, a long torch upright in her left.
  ceres: { r: [[0.27, 1.18, 0.06], [0.3, 1.02, 0.28], [0.1, -0.2, 1], [-1, 0, 0]], l: [[-0.27, 1.2, 0.04], [-0.26, 1.18, 0.26], [0, 1, 0.1], [1, 0, 0]] },
  // Venus Genetrix: her right hand up at her shoulder lifting the mantle, an apple in her left.
  venus: { r: [[0.3, 1.24, 0.1], [0.2, 1.48, 0.16], [0, 1, 0], [-1, 0, 0]], l: [[-0.25, 1.15, 0.1], [-0.2, 1.04, 0.3], [0.1, 0, 1], [0, 1, 0]] },
  // Pax and Fortuna: an olive branch or the rudder in the right, the horn of plenty in the left arm.
  pax: { r: [[0.28, 1.2, 0.08], [0.32, 1.12, 0.32], [0.1, 0.2, 1], [-1, 0, 0]], l: [[-0.25, 1.17, 0.06], [-0.2, 1.16, 0.26], [0.2, 1, 0.2], [1, 0, 0]] },
};

/**
 * A goddess in a long chiton to her feet, a mantle over her shoulder (and
 * over her head, veiled, as Ceres is shown), about 1.75 m, standing on y 0
 * facing +z: { stone: [...], gear: [...] } (gear: what she holds).
 */
export function goddess(lod = 0, { pose = 'ceres', veil = false, diadem = false, seed = 5 } = {}) {
  const out = { stone: [], gear: [] };
  const R = lod === 2 ? 5 : lod ? 8 : 12;
  out.stone.push(skirt(1.02, 0.0, 0.17, 0.27, lod, { folds: 13, deep: 0.02, seed, back: 0.03 }));
  out.stone.push(loft([
    [0.96, 0, 0, 0.18, 0.13], [1.06, 0, 0.002, 0.155, 0.112], [1.15, 0, 0.006, 0.14, 0.105], [1.24, 0, 0.012, 0.155, 0.12],
    [1.32, 0, 0.014, 0.162, 0.125], [1.39, 0, 0.0, 0.172, 0.105], [1.45, 0, -0.01, 0.165, 0.09], [1.49, 0, -0.01, 0.12, 0.07], [1.53, 0, -0.004, 0.05, 0.048],
  ], {
    seg: lod === 2 ? 8 : lod ? 14 : 24, smooth: lod === 2 ? 1 : 2,
    deform: (p, th) => {
      const front = Math.max(0, Math.cos(th));
      // The breasts under the thin chiton, the girdle under them.
      p.z += front * 0.03 * Math.exp(-(((p.y - 1.3) / 0.05) ** 2)) * Math.exp(-(((Math.abs(p.x) - 0.075) / 0.05) ** 2));
      p.z -= front * 0.006 * Math.exp(-(((p.y - 1.2) / 0.012) ** 2));
    },
    tint: (q) => 0.82 + 0.18 * smoothstep(0.95, 1.35, q.y),
  }));
  // The mantle (himation): wound round her hips, its end over her left shoulder and down her back.
  out.stone.push(tube([[0.2, 1.0, 0.04], [0.12, 0.86, 0.17], [-0.06, 0.82, 0.18], [-0.19, 0.96, 0.08], [-0.17, 1.42, 0.0], [-0.1, 1.5, -0.08]], 0.05, { radial: R, segments: lod ? 10 : 24, around: 0.3 }));
  out.stone.push(drape([0.0, 1.45, -0.1], [0.02, 0.2, -0.2], 0.2, 0.28, lod, { seed: seed + 3, thick: 0.03 }));
  const P = POSES[pose] || POSES.ceres;
  const sh = { r: [0.19, 1.43, -0.005], l: [-0.19, 1.43, -0.005] };
  for (const s of ['r', 'l']) {
    const [el, wr, reach, palm] = P[s];
    out.stone.push(...arm(sh[s], el, wr, reach, palm, lod));
    if (lod < 2) out.stone.push(...hand(v3(wr), v3(reach), v3(palm), lod));
  }
  const h = head(0.0, 1.635, 0.02, 0, { lod, veil, scale: 0.93 });
  out.stone.push(...h.skin, ...h.hair);
  if (diadem && lod < 2) {
    const d = new TorusGeometry(0.085, 0.012, 4, 16, Math.PI);
    d.rotateX(-Math.PI / 2 + 0.25);
    d.rotateZ(Math.PI);
    d.translate(0, 1.7, 0.01);
    out.gear.push(tintGeometry(boxUV(d)));
  }
  // What she holds.
  const [, wr] = P.r;
  const [, wl] = P.l;
  if (pose === 'ceres') {
    // A bunch of wheat ears and poppies in her right hand; the long torch in her left.
    for (const g of wheatSheaf(lod, 'gilt', 9).gilt) out.gear.push(g.scale(0.32, 0.32, 0.32).translate(wr[0] + 0.02, wr[1] - 0.12, wr[2] + 0.06));
    for (const g of torch(lod, 'gilt', 1.75).gilt) out.gear.push(g.translate(wl[0], 0.0, wl[2] + 0.02));
  } else if (pose === 'venus') {
    out.gear.push(ellipsoid(0.04, 1, 1, 1, wl[0] + 0.01, wl[1] + 0.06, wl[2] + 0.04, 8, 6));
  } else {
    // The horn of plenty in her left arm, fruit at its mouth; an olive branch in her right.
    out.gear.push(member([v3([wl[0] + 0.02, wl[1] - 0.16, wl[2] - 0.02]), v3([wl[0] - 0.02, wl[1] + 0.05, wl[2] + 0.04]), v3([wl[0] - 0.08, wl[1] + 0.32, wl[2] - 0.02]), v3([wl[0] - 0.05, wl[1] + 0.45, wl[2] - 0.06])], 0.02, 0.09, { radial: R, segs: lod ? 4 : 8 }));
    if (lod < 2) for (let k = 0; k < 4; k++) out.gear.push(ellipsoid(0.04, 1, 1, 1, wl[0] - 0.05 + (k % 2 - 0.5) * 0.06, wl[1] + 0.5 + (k > 1 ? 0.04 : 0), wl[2] - 0.06 + (k - 1.5) * 0.02, 6, 4));
    out.gear.push(tube([[wr[0], wr[1], wr[2]], [wr[0] + 0.08, wr[1] + 0.12, wr[2] + 0.12], [wr[0] + 0.12, wr[1] + 0.28, wr[2] + 0.18]], 0.008, { radial: 4, segments: 4, around: 0.1 }));
  }
  return out;
}

/**
 * Mercury, young and beardless, his short cloak (chlamys) pinned at his
 * right shoulder and wrapped over his left arm, the purse in his right hand
 * held down, the caduceus in his left, the winged hat on his head; his
 * weight on his right leg. About 1.8 m, on y 0, facing +z: { stone, gear }.
 */
export function mercury(lod = 0, seed = 7) {
  const out = { stone: [], gear: [] };
  out.stone.push(...leg([0.09, 0.92, 0], [0.095, 0.5, 0.025], [0.09, 0.09, 0.0], [0.15, 0, 1], lod));
  out.stone.push(...leg([-0.09, 0.9, -0.01], [-0.12, 0.5, -0.04], [-0.15, 0.13, -0.17], [-0.12, -0.4, 1], lod));
  out.stone.push(torso(lod));
  out.stone.push(...arm([0.205, 1.44, -0.005], [0.25, 1.17, 0.03], [0.27, 0.95, 0.1], [0, -1, 0.2], [-1, 0, 0], lod));
  out.stone.push(...arm([-0.205, 1.44, -0.005], [-0.26, 1.2, 0.1], [-0.24, 1.1, 0.32], [0, 0.6, 1], [1, 0, 0], lod));
  if (lod < 2) {
    out.stone.push(...hand(v3([0.27, 0.95, 0.1]), v3([0, -1, 0.2]), v3([-1, 0, 0]), lod));
    out.stone.push(...hand(v3([-0.24, 1.1, 0.32]), v3([0, 0.6, 1]), v3([1, 0, 0]), lod));
  }
  // The chlamys: over the left shoulder and down the back, its end hanging from the forearm.
  out.stone.push(drape([-0.12, 1.47, -0.08], [-0.16, 0.75, -0.15], 0.14, 0.2, lod, { seed, thick: 0.03 }));
  out.stone.push(drape([-0.26, 1.15, 0.24], [-0.29, 0.62, 0.2], 0.05, 0.1, lod, { seed: seed + 2, turn: 0.3 }));
  const h = head(0.004, 1.705, 0.02, 0.15, { lod, beard: false, scale: 1.04 });
  out.stone.push(...h.skin, ...h.hair);
  for (const g of Object.values(petasus(lod, 'gilt', 0.3)).flat()) out.gear.push(g.translate(0.004, 1.8, 0.0));
  for (const g of Object.values(purse(lod, 'gilt', 0.16)).flat()) out.gear.push(g.translate(0.27, 0.72, 0.13));
  for (const g of Object.values(caduceus(lod, 'gilt', 0.95)).flat()) out.gear.push(g.translate(-0.24, 0.62, 0.34));
  return out;
}

/**
 * A god's cult statue, standing (or enthroned) on y 0 facing +z, about
 * 1.8 m tall before the caller's scale: { stone (marble), gear (gilt) }.
 * Mars in his cuirass and crested helmet with spear and shield; Neptune
 * enthroned, trident in hand and a dolphin on the other; the goddesses
 * draped; Mercury as above. `lod` 0 or 1 (2 is a mass for far off).
 */
export function cultStatue(god, lod = 0) {
  if (god === 'ceres') return goddess(lod, { pose: 'ceres', veil: true, seed: 11 });
  if (god === 'venus') return goddess(lod, { pose: 'venus', diadem: true, seed: 13 });
  if (god === 'pax' || god === 'fortuna') return goddess(lod, { pose: 'pax', diadem: god === 'fortuna', seed: 17 });
  if (god === 'mercury') return mercury(lod);
  const out = { stone: [], gear: [] };
  if (god === 'mars') {
    const f = figure('cuirass', { lod, seed: 3, beard: true });
    out.stone.push(...f.flesh, ...f.cloth, ...f.hair);
    out.gear.push(...f.gear, ...f.wreath);
    for (const g of Object.values(helmet(lod, 'gilt', 0.42)).flat()) out.gear.push(g.translate(0.004, 1.74, 0.0));
    for (const g of Object.values(clipeus(lod, 'gilt', 0.38)).flat()) out.gear.push(g.rotateY(-1.2).translate(-0.42, 0.62, 0.05));
    return out;
  }
  // Neptune enthroned: the throne, the god on it bare to the waist, his trident high in his right hand.
  // (The seated figure sits with its seat at y 0: lifted onto the throne's seat, 0.46 up, set back on it.)
  const seat = 0.46;
  const tz = -0.25;
  out.stone.push(...throne(1).map((g) => g.translate(0, 0, tz - 0.05)));
  const f = figure('seated', { lod, seed: 5, beard: true, wreath: false });
  for (const g of [...f.flesh, ...f.cloth, ...f.hair]) out.stone.push(g.translate(0, seat, tz));
  const up = 0.08 - 0.9;
  for (const g of Object.values(trident(lod, 'gilt', 2.6)).flat()) out.gear.push(g.translate(0.34, seat - 0.44, tz + 0.13));
  for (const g of Object.values(dolphin(lod, 'gilt', 0.38)).flat()) out.gear.push(g.translate(-0.21, seat + 1.24 + up, tz + 0.42));
  // (The seated figure's own sceptre and Victory are left out: his are the trident and the dolphin.)
  return out;
}

/** The throne an enthroned god sits on (its seat at y 0.46 of `s`), on y 0: geometries for its stone. */
export function throne(s = 1) {
  const parts = [
    box(0.74, 0.46, 0.62, 0, 0, -0.02),
    box(0.74, 0.92, 0.12, 0, 0.46, -0.27),
    box(0.6, 0.1, 0.38, 0, 0, 0.42),
  ];
  for (const sx of [-1, 1]) parts.push(box(0.08, 0.3, 0.52, sx * 0.37, 0.46, 0.02));
  for (const g of parts) g.scale(s, s, s);
  return parts;
}

export { BoxGeometry };
