/**
 * models/learning.js
 * ----------------------------------------------------------------------------
 * What the school, the library and the academy of the 3D look share
 * (ludus.js, bibliotheca.js, academia.js): their people, most of them
 * seated (boys on benches with tablets on their knees, readers with a
 * scroll open, a master in his chair), the things of Roman learning (wax
 * tablets, book rolls with their tags, the round book box or capsa, a
 * cupboard of rolls, a herm), garden things for the academy's court (a
 * cypress, clipped box), an arc swept out of a profile (an exedra's bench
 * and wall, the master's round-backed chair) and a tiled slope with the
 * boards under it.
 *
 * Why people of their own: figure.js stands its one mannequin up, and a
 * school is a room of people sitting. person() is that mannequin lighter
 * (fewer segments: a school holds nine of them, the academy a dozen) and
 * posable: standing or seated, arms down, a tablet on the lap, a roll held
 * open, a hand raised to teach or to declaim. Its clothes are the forts'
 * one dyed cloth (castra.js people: the colour in the vertices), and every
 * skin and every head of hair one material each, toned by its vertices, so
 * a crowd costs a draw a material, not a draw a person.
 *
 * Metres, y up, facing +z, as the other models (models/well.js); every
 * geometry has position, normal, uv (metres) and an RGB colour, so merge()
 * takes them.
 * ----------------------------------------------------------------------------
 */

import {
  Vector3, Quaternion, Matrix4, CapsuleGeometry, SphereGeometry, CylinderGeometry, BoxGeometry, CircleGeometry,
  IcosahedronGeometry, BufferGeometry, Float32BufferAttribute,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { artRng } from '../texgen.js';
import { slab, tiledRoof } from './masonry.js';
import { lin, ruralMaterials } from './rural.js';
import { box, castraMaterials, flipFaces, inscribe } from './castra.js';

/** The materials the three share besides the forts' (castra.js castraMaterials). */
export function learningMaterials() {
  return {
    ...castraMaterials(),
    // Book rolls: papyrus and parchment, matte, their tones in the vertices (kept under a roof or in
    // hand: no snow settles on them).
    papyrus: material('papyrus', { color: 0xffffff, roughness: 0.85, vertexColors: true, snow: 0 }),
    // Floors and furniture under a roof: the look lays snow by a surface's facing, not by what is over
    // it, so what a roof shelters takes none.
    shelteredFloor: material('cocciopesto-sheltered', { surface: 'cocciopesto', vertexColors: true, snow: 0 }),
    shelteredMarble: material('marble-sheltered', { surface: 'marble', vertexColors: true, snow: 0 }),
    shelteredWood: material('wood-sheltered', { surface: 'wood', vertexColors: true, snow: 0 }),
    shelteredStone: material('travertine-sheltered', { surface: 'travertine', vertexColors: true, snow: 0 }),
    // Every face and hand one material, every head of hair another: their tones in the vertices.
    skin: material('skin-tones', { color: 0xffffff, roughness: 0.55, vertexColors: true, snow: 0, wet: 0 }),
    hair: material('hair-tones', { color: 0xffffff, roughness: 0.7, vertexColors: true, snow: 0.2 }),
    leather: material('leather', { color: 0x3b2a1e, roughness: 0.65, snow: 0.2 }),
    // The garden's evergreens (the farms' foliage: one program for leaves and blossom).
    leaf: ruralMaterials().leaf,
    wicker: ruralMaterials().wicker,
    earth: ruralMaterials().earth,
  };
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** A capsule from a to b (Vector3s), radius r, few segments: a limb seen from a few metres. */
function limb(a, b, r, radial = 7) {
  const len = a.distanceTo(b);
  const g = new CapsuleGeometry(r, Math.max(0.001, len), 2, radial);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return boxUV(g);
}

/** Paint a geometry one linear colour times `k`, over the shading already in its vertex colours (if any). */
function coloured(g, rgb, k = 1) {
  const was = g.attributes.color;
  if (!was) return tintGeometry(g, () => [rgb[0] * k, rgb[1] * k, rgb[2] * k]);
  for (let i = 0; i < was.count; i++) was.setXYZ(i, was.getX(i) * rgb[0] * k, was.getY(i) * rgb[1] * k, was.getZ(i) * rgb[2] * k);
  return g;
}

const STAND_HIP = 0.86;
/** A seated person's hip joint over the seat. */
const SIT_HIP = 0.08;

/**
 * The hands' places for an arm pose, in the person's own metres (standing
 * on y 0, facing +z), and the seat's height `s` for a seated one:
 * [left wrist, right wrist] or null for arms hanging.
 */
function wrists(arms, sit, s) {
  const v = (x, y, z) => new Vector3(x, y, z);
  if (sit) {
    switch (arms) {
      case 'read': return [v(-0.16, s + 0.42, 0.3), v(0.16, s + 0.42, 0.3)];
      case 'teach': return [v(-0.14, s + 0.2, 0.28), v(0.3, s + 0.66, 0.26)];
      case 'write': return [v(-0.15, s + 0.2, 0.27), v(0.05, s + 0.23, 0.33)];
      case 'chin': return [v(-0.13, s + 0.2, 0.28), v(0.05, s + 0.68, 0.16)];
      default: return [v(-0.13, s + 0.19, 0.3), v(0.13, s + 0.19, 0.3)];
    }
  }
  switch (arms) {
    case 'hold': return [v(-0.14, 1.12, 0.28), v(0.14, 1.12, 0.28)];
    case 'orate': return [v(-0.16, 1.0, 0.14), v(0.3, 1.58, 0.36)];
    case 'reach': return [v(-0.25, 0.86, 0.06), v(0.2, 1.3, 0.42)];
    case 'spear': return [v(-0.34, 0.98, 0.12), v(0.3, 1.4, 0.08)];
    default: return null;
  }
}

/**
 * A person, as geometries by material, placed at (x, y, z) facing ry, at
 * `scale` (a boy is about 0.75). Options:
 *   cloth, cloth2  the tunic's colour and a mantle's (pallium, toga: null for none)
 *   skin, hair     colours; beard: a philosopher's
 *   sit            the seat's height over the feet (0 standing)
 *   long           a garment to the ankles (a man of standing, a teacher)
 *   arms           down, lap, read, write, teach, chin (seated); hold,
 *                  orate, reach, spear (standing)
 *   lean           forward over the hips (radians, seated)
 * Returns [{ g, material }] for castra.js people() (or a TaggedParts add).
 */
export function person(mats, opts, x, y, z, ry, scale = 1) {
  const { cloth = 0xc9bca2, cloth2 = null, skin = 0xa87a58, hair = 0x2e2119, sit = 0, long = false, arms = sit ? 'lap' : 'down', lean = sit ? 0.1 : 0, beard = false } = opts;
  const seated = sit > 0;
  const clothRGB = lin(cloth);
  const skinRGB = lin(skin);
  const hairRGB = lin(hair);
  const out = { cloth: [], skin: [], hair: [], leather: [] };
  // Above the hips: built as figure.js stands, moved down onto the seat and leaned forward over it.
  const dy = seated ? sit + SIT_HIP - STAND_HIP : 0;
  const hipY = STAND_HIP + dy;
  const up = new Matrix4().makeTranslation(0, -hipY, 0);
  up.premultiply(new Matrix4().makeRotationX(lean));
  up.premultiply(new Matrix4().makeTranslation(0, hipY, 0));
  up.multiply(new Matrix4().makeTranslation(0, dy, 0));
  const upper = (g) => g.applyMatrix4(up);
  const upperV = (v) => v.applyMatrix4(up);
  // The garment, turned: from the hem (standing) or the seat (seated) up to the shoulders.
  const hem = long ? 0.07 : 0.5;
  const prof = seated
    ? [[0, 0.79], [0.17, 0.79], [0.19, 0.85], [0.16, 0.97], [0.142, 1.0], [0.15, 1.02], [0.165, 1.15], [0.17, 1.28], [0.19, 1.36], [0.16, 1.42], [0.07, 1.46], [0.05, 1.47], [0, 1.47]]
    : [[0, hem - 0.01], [0.2, hem], [0.205, hem + 0.02], [long ? 0.2 : 0.185, 0.8], [0.15, 0.98], [0.142, 1.0], [0.15, 1.02], [0.165, 1.15], [0.17, 1.28], [0.19, 1.36], [0.16, 1.42], [0.07, 1.46], [0.05, 1.47], [0, 1.47]];
  const body = revolve(profileOf(prof), { segments: 14, metres: 0.12, tint: (p) => (p.y < 1.02 && p.y > 0.97 ? 0.6 : 0.85 + 0.15 * Math.min(1, (p.y - 0.5) / 0.3)) });
  body.scale(1, 1, 0.7);
  out.cloth.push(coloured(upper(body), clothRGB));
  // Legs.
  for (const s of [-1, 1]) {
    if (seated) {
      const hip = new Vector3(s * 0.09, sit + SIT_HIP, 0.02);
      const knee = new Vector3(s * 0.1, sit + 0.07, 0.43);
      const ankle = new Vector3(s * 0.1, 0.08, 0.47);
      out.cloth.push(coloured(limb(hip, knee, 0.072, 7), clothRGB, 0.92));
      out[long ? 'cloth' : 'skin'].push(coloured(limb(knee, ankle, 0.047, 6), long ? clothRGB : skinRGB, long ? 0.85 : 1));
      out.leather.push(tintGeometry(boxUV(new BoxGeometry(0.085, 0.05, 0.22).translate(s * 0.1, 0.025, 0.53))));
    } else {
      out.skin.push(coloured(limb(new Vector3(s * 0.085, 0.86, 0), new Vector3(s * 0.095, 0.08, 0), 0.052, 6), skinRGB));
      out.leather.push(tintGeometry(boxUV(new BoxGeometry(0.085, 0.05, 0.24).translate(s * 0.095, 0.025, 0.05))));
    }
  }
  // Arms: the sleeve to the elbow in cloth, the forearm and hand bare.
  const w = wrists(arms, seated, sit);
  for (const s of [-1, 1]) {
    const sh = upperV(new Vector3(s * 0.2, 1.36, 0));
    let el;
    let wr;
    if (!w) {
      el = upperV(new Vector3(s * 0.24, 1.1, 0.02));
      wr = upperV(new Vector3(s * 0.25, 0.86, 0.06));
    } else {
      wr = w[s < 0 ? 0 : 1].clone();
      el = sh.clone().add(wr).multiplyScalar(0.5).add(new Vector3(s * 0.07, -0.09, -0.04));
    }
    out.cloth.push(coloured(limb(sh, el, 0.055, 7), clothRGB));
    out.skin.push(coloured(limb(el, wr, 0.037, 6), skinRGB));
    const hand = new SphereGeometry(0.044, 7, 5);
    hand.scale(0.8, 1.15, 0.65);
    const hp = wr.clone().add(wr.clone().sub(el).normalize().multiplyScalar(0.045));
    hand.translate(hp.x, hp.y, hp.z);
    out.skin.push(coloured(boxUV(hand), skinRGB));
  }
  // Neck, head, hair (and a philosopher's beard).
  out.skin.push(coloured(upper(limb(new Vector3(0, 1.43, 0), new Vector3(0, 1.52, 0.01), 0.045, 6)), skinRGB));
  const head = new SphereGeometry(0.1, 12, 9);
  head.scale(0.92, 1.12, 1.02);
  head.translate(0, 1.6, 0.012);
  out.skin.push(coloured(upper(boxUV(head)), skinRGB));
  const cap = new SphereGeometry(0.106, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
  cap.scale(0.94, 1.1, 1.05);
  cap.rotateX(-0.35);
  cap.translate(0, 1.615, -0.006);
  out.hair.push(coloured(upper(boxUV(cap)), hairRGB));
  if (beard) {
    // (Up against the jaw, so it reads as the face's, not a second head.)
    const b = new SphereGeometry(0.072, 9, 6);
    b.scale(0.95, 1.1, 0.72);
    b.translate(0, 1.545, 0.055);
    out.hair.push(coloured(upper(boxUV(b)), hairRGB));
  }
  // A mantle over the shoulders (the pallium of a Greek master, a citizen's toga), and over the lap seated.
  if (cloth2 !== null) {
    const c2 = lin(cloth2);
    const palla = revolve(profileOf([[0.0, 1.0], [0.215, 1.0], [0.22, 1.05], [0.205, 1.3], [0.175, 1.4], [0.08, 1.46], [0.0, 1.47]]), { segments: 14, metres: 0.12, tint: (p) => 0.8 + 0.2 * Math.min(1, (p.y - 1.0) / 0.3) });
    palla.scale(1.04, 1, 0.76);
    out.cloth.push(coloured(upper(palla), c2));
    if (seated) {
      const lap = new BoxGeometry(0.4, 0.07, 0.42);
      lap.translate(0, sit + 0.13, 0.25);
      out.cloth.push(coloured(boxUV(lap), c2, 0.9));
    }
  }
  // Placed: scaled, turned, moved.
  const place = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ry), new Vector3(scale, scale, scale));
  const parts = [];
  for (const [k, list] of Object.entries(out)) {
    for (const g of list) {
      g.applyMatrix4(place);
      for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(n)) g.deleteAttribute(n);
      parts.push({ g, material: mats[k] });
    }
  }
  return parts;
}

/** A point of a person's frame (dx right, dz ahead of them) in the model's: for what they hold. */
export function at(x, z, ry, dx, dz) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return [x + dx * c + dz * s, z - dx * s + dz * c];
}

// ---------------------------------------------------------------------------
// The things of learning
// ---------------------------------------------------------------------------

/**
 * A wax tablet (tabula cerata) lying at (x, y, z) turned ry: a wooden frame
 * round a bed of black wax, `w` by `d`. Returns { wood, wax }.
 */
export function tablet(x, y, z, ry = 0, w = 0.2, d = 0.14, tilt = 0) {
  const frame = box(w, 0.012, d, 0, 0, 0, 0.9);
  const wax = box(w - 0.03, 0.004, d - 0.03, 0, 0.012, 0, 1);
  for (const g of [frame, wax]) {
    g.rotateX(tilt);
    g.rotateY(ry);
    g.translate(x, y, z);
  }
  return { wood: [frame], wax: [tintGeometry(wax, () => lin(0x231c16))] };
}

/** A book roll (volumen) lying along x, its middle at (x, y, z): papyrus wound on its rod, the rod's knobs, a tag. */
export function roll(len, r, x, y, z, { ry = 0, tone = 1, seg = 7, tag = null } = {}) {
  const g = new CylinderGeometry(r, r, len, seg, 1);
  g.rotateZ(Math.PI / 2);
  // The papyrus darker toward its ends (handled), a lighter middle.
  const k = 0.95 * tone;
  const paper = tintGeometry(boxUV(g), (px) => {
    const e = Math.abs(px) / (len / 2);
    return [0.82 * k * (1 - 0.18 * e), 0.71 * k * (1 - 0.2 * e), 0.5 * k * (1 - 0.25 * e)];
  });
  const out = { paper: [paper], tags: [] };
  if (tag) {
    // The titulus: a little strip of parchment hanging from the roll's end, in its colour.
    out.tags.push(tintGeometry(boxUV(new BoxGeometry(0.004, 0.045, 0.018).translate(len / 2 + 0.003, -r - 0.012, 0)), () => tag));
  }
  for (const list of Object.values(out)) {
    for (const p of list) {
      p.rotateY(ry);
      p.translate(x, y + r, z);
    }
  }
  return out;
}

/** The tags' colours (the tituli were dyed: red, purple, saffron). */
const TAGS = [lin(0x9a2a1e), lin(0x6a2a4a), lin(0xc89a3a), lin(0x8a6a3a)];

/**
 * A capsa: the round box of rolls a boy's slave (the capsarius) carried to
 * school, leather over a wooden hoop, a strap; open (its lid beside it and
 * the rolls standing in it) or shut. Its foot at (x, y, z). Returns
 * { leather, paper, strap }.
 */
export function capsa(x, y, z, { r = 0.13, h = 0.3, open = true, seed = 1, lod = 0 } = {}) {
  const seg = lod ? 8 : 12;
  const rnd = artRng(seed);
  const out = { leather: [], paper: [], strap: [] };
  out.leather.push(tintGeometry(boxUV(new CylinderGeometry(r, r * 0.96, h, seg, 1, open).translate(x, y + h / 2, z)), (px, py) => 0.7 + 0.3 * ((py - y) / h)));
  if (open) {
    // The rolls standing in it, their tops out of it, a tag on each.
    const n = 5;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd();
      const rr = k === n - 1 ? 0 : r * 0.55;
      const len = h + 0.04 + rnd() * 0.05;
      const g = new CylinderGeometry(0.03, 0.03, len, 6, 1);
      g.translate(x + Math.cos(a) * rr, y + len / 2, z + Math.sin(a) * rr);
      const t = 0.85 + rnd() * 0.2;
      out.paper.push(tintGeometry(boxUV(g), () => [0.8 * t, 0.68 * t, 0.48 * t]));
    }
    // The lid on the ground beside it.
    const lid = new CylinderGeometry(r + 0.01, r + 0.01, 0.05, seg, 1);
    lid.translate(x + r * 1.9, y + 0.025, z + 0.02);
    out.leather.push(tintGeometry(boxUV(lid), () => 0.8));
  } else {
    const lid = new CylinderGeometry(r + 0.01, r + 0.01, 0.06, seg, 1);
    lid.translate(x, y + h + 0.01, z);
    out.leather.push(tintGeometry(boxUV(lid), () => 0.85));
  }
  // The carrying strap over it.
  if (lod === 0) out.strap.push(box(0.03, 0.006, 2 * r + 0.02, x, y + h + (open ? -0.03 : 0.04), z, 0.6));
  return out;
}

/**
 * An armarium: a wooden cupboard of book rolls, `w` x `h` x `d`, its back
 * against a wall at z = 0 and its front toward +z, centred on x, its foot at
 * y 0; shelves (`shelves`) of rolls lying with their ends out, each with a
 * tag; two doors, swung open (staffed) or shut. Returns { wood, doorOpen,
 * doorShut, paper, tags, dark }.
 */
export function armarium(w, h, d, { shelves = 4, lod = 0, seed = 1, rollsAt = lod } = {}) {
  const rnd = artRng(seed);
  const t = 0.04;
  const out = { wood: [], doorOpen: [], doorShut: [], paper: [], tags: [], dark: [] };
  // The carcass: back, sides, top with a cornice, bottom on a plinth.
  out.dark.push(box(w - 2 * t, h - 0.2, 0.01, 0, 0.12, t, 0.7));
  for (const s of [-1, 1]) out.wood.push(box(t, h, d, s * (w / 2 - t / 2), 0, d / 2, 0.85));
  out.wood.push(box(w + 0.06, 0.06, d + 0.05, 0, h, d / 2 + 0.01, 0.95));
  out.wood.push(box(w, 0.12, d, 0, 0, d / 2, 0.75));
  const inner = (h - 0.12 - t) / shelves;
  for (let k = 1; k < shelves; k++) out.wood.push(box(w - 2 * t, 0.025, d - 0.03, 0, 0.12 + k * inner, d / 2 - 0.01, 0.9));
  // The rolls, ends out, two deep on each shelf (the ends are what a reader saw: the tags). Only the
  // front of each shows, so each is a short stub (its end and a hand of its side), not a whole roll.
  if (rollsAt === 0) {
    const r = 0.034;
    for (let k = 0; k < shelves; k++) {
      const y0 = 0.12 + k * inner + 0.025;
      const per = Math.floor((w - 2 * t - 0.02) / (2 * r + 0.006));
      const rows = Math.max(1, Math.min(2, Math.floor((inner - 0.04) / (2 * r))));
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < per - (j % 2); i++) {
          if (rnd() < 0.1) continue;
          const xx = -w / 2 + t + 0.01 + r + (j % 2) * r + i * (2 * r + 0.006);
          const out0 = rnd() * 0.04;
          const len = 0.12;
          // (Open at the back, its front capped: the back of a stub is never seen.)
          const g = new CylinderGeometry(r, r, len, 6, 1, true);
          g.rotateX(Math.PI / 2);
          const cap = new CircleGeometry(r, 6);
          cap.translate(0, 0, len / 2);
          const yy = y0 + r + j * (2 * r - 0.006);
          const z0 = d - 0.02 - out0 - len / 2;
          g.translate(xx, yy, z0);
          cap.translate(xx, yy, z0);
          const tn = 0.8 + rnd() * 0.3;
          out.paper.push(tintGeometry(boxUV(g), () => [0.82 * tn, 0.7 * tn, 0.5 * tn]));
          out.paper.push(tintGeometry(boxUV(cap), () => [0.6 * tn, 0.48 * tn, 0.32 * tn]));
          if (rnd() < 0.55) {
            out.tags.push(tintGeometry(boxUV(new BoxGeometry(0.016, 0.045, 0.004).translate(xx, y0 + r + j * (2 * r - 0.006) - r - 0.01, d - 0.018 - out0)), () => TAGS[Math.floor(rnd() * TAGS.length)]));
          }
        }
      }
      // The shelf's dark depth behind the rolls.
      out.dark.push(box(w - 2 * t, inner - 0.03, 0.01, 0, y0, d - 0.16, 0.6));
    }
  } else {
    // Far out, each shelf's rolls are one block of their colour.
    for (let k = 0; k < shelves; k++) out.paper.push(tintGeometry(box(w - 2 * t - 0.02, inner - 0.05, d - 0.06, 0, 0.12 + k * inner + 0.025, d / 2 - 0.01, 1), () => [0.72, 0.6, 0.42]));
  }
  // The doors: two leaves, shut across the front or swung back against the sides.
  const lw = w / 2 - 0.01;
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const leaf = box(lw, h - 0.14, 0.025, -s * lw / 2, 0, 0, 0.82);
      // A panel moulding on its face, close up.
      const parts = [leaf];
      if (lod === 0) {
        parts.push(box(lw - 0.1, (h - 0.14) / 2 - 0.08, 0.012, -s * lw / 2, 0.06, 0.018, 0.7), box(lw - 0.1, (h - 0.14) / 2 - 0.08, 0.012, -s * lw / 2, (h - 0.14) / 2 + 0.02, 0.018, 0.7));
      }
      for (const g of parts) {
        g.rotateY(open ? s * 1.75 : 0);
        g.translate(s * (w / 2 - 0.005), 0.1, d + 0.012);
        (open ? out.doorOpen : out.doorShut).push(g);
      }
    }
  }
  return out;
}

/**
 * A herm: a pillar narrowing to its foot with a portrait head on it, the
 * Greek way of setting up a poet or a philosopher (Plato's and Homer's are
 * known from Roman copies), `h` tall to the top of the head, its foot at
 * (x, y, z), facing ry, its `name` cut on the shaft (close up). Returns
 * { stone, letters }: marble, and the letters' strokes for the paint.
 */
export function herm(x, y, z, ry, { h = 1.75, lod = 0, beard = true, name = null } = {}) {
  const out = [];
  const letters = [];
  const shaft = h - 0.42;
  // The shaft: a tapering square pillar on a plinth, a moulded top.
  const g = new BoxGeometry(0.26, shaft, 0.22, 1, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setXYZ(i, p.getX(i) * 0.78, p.getY(i), p.getZ(i) * 0.82);
  g.computeVertexNormals();
  g.translate(0, shaft / 2 + 0.08, 0);
  out.push(tintGeometry(boxUV(g), (px, py) => 0.86 + 0.14 * Math.min(1, py / 0.8)));
  out.push(slab(0.3, 0.08, 0.26, { bevel: 0.01, seed: 3, wobble: 0, tone: 0, grime: 0.3 }));
  out.push(slab(0.3, 0.05, 0.27, { bevel: 0.008, seed: 4, wobble: 0, tone: 0, grime: 0 }).translate(0, shaft + 0.06, 0));
  // The head: the skull, the neck, the beard, a fillet of hair.
  const seg = lod === 2 ? 5 : lod ? 8 : 14;
  const head = new SphereGeometry(0.105, seg, Math.round(seg * 0.75));
  head.scale(0.9, 1.15, 1.0);
  head.translate(0, shaft + 0.32, 0.01);
  out.push(tintGeometry(boxUV(head)));
  out.push(tintGeometry(boxUV(new CylinderGeometry(0.06, 0.075, 0.16, seg, 1).translate(0, shaft + 0.18, 0))));
  if (beard && lod < 2) {
    // The beard against the jaw, the hair a cap over the skull.
    const b = new SphereGeometry(0.08, seg, Math.round(seg * 0.6));
    b.scale(0.92, 1.12, 0.72);
    b.translate(0, shaft + 0.25, 0.05);
    out.push(tintGeometry(boxUV(b), () => 0.92));
  }
  if (lod < 2) {
    const cap = new SphereGeometry(0.11, seg, Math.round(seg * 0.4), 0, Math.PI * 2, 0, Math.PI * 0.5);
    cap.scale(0.92, 1.0, 1.02);
    cap.rotateX(-0.3);
    cap.translate(0, shaft + 0.34, -0.005);
    out.push(tintGeometry(boxUV(cap), () => 0.9));
  }
  // The name, cut in small capitals high on the shaft's face (where the taper leaves it 0.25 wide).
  if (name && lod === 0) {
    const yy = shaft - 0.12;
    const face = 0.11 * (0.82 + 0.18 * ((yy - 0.08) / shaft)) + 0.003;
    letters.push(...inscribe(name, yy, face, 0.034));
  }
  for (const o of [...out, ...letters]) {
    o.rotateY(ry);
    o.translate(x, y, z);
  }
  return { stone: out, letters };
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/**
 * A profile ([r, y], walked as revolve's: up the outside, inward over the
 * top, down the inside) swept round the y axis from angle a0 to a1 (radians,
 * x = r sin a, z = r cos a: 0 is +z, a half turn -z), with its two ends
 * capped: an exedra's bench and wall, the master's round-backed chair. UVs
 * in metres along the arc (at the profile's widest) and along the profile.
 */
export function arcSweep(profile, a0, a1, { segments = 24, tint = null, caps = true } = {}) {
  const P = profile.length;
  const pos = [];
  const uv = [];
  const col = [];
  const idx = [];
  const arc = [0];
  let rMax = 0;
  for (let i = 1; i < P; i++) arc.push(arc[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  for (const [r] of profile) rMax = Math.max(rMax, r);
  const push = (x, y, z, u, v, t) => {
    pos.push(x, y, z);
    uv.push(u, v);
    const c = typeof t === 'number' ? [t, t, t] : t;
    col.push(c[0], c[1], c[2]);
  };
  for (let j = 0; j <= segments; j++) {
    const th = a0 + ((a1 - a0) * j) / segments;
    const s = Math.sin(th);
    const c = Math.cos(th);
    for (let i = 0; i < P; i++) {
      const [r, y] = profile[i];
      const p = { x: r * s, y, z: r * c };
      push(p.x, p.y, p.z, th * rMax, arc[i], tint ? tint(p, th, i) : 1);
    }
  }
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < P - 1; i++) {
      const a = j * P + i;
      const b = a + P;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // (Built with the angle growing; a sweep the other way round faces in: turn its faces.)
  if (a1 < a0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  if (caps) {
    // Each end a fan over the profile (convex enough for a bench's or a wall's section), facing away from the sweep.
    for (const [th, sign] of [[a0, -1], [a1, 1]]) {
      const base = pos.length / 3;
      const s = Math.sin(th);
      const c = Math.cos(th);
      for (let i = 0; i < P; i++) {
        const [r, y] = profile[i];
        push(r * s, y, r * c, r, y, tint ? tint({ x: r * s, y, z: r * c }, th, i) : 1);
      }
      const dir = Math.sign(a1 - a0) * sign;
      // The tangent of the arc at th, growing angle: (cos th, 0, -sin th).
      const tx = c * dir;
      const tz = -s * dir;
      for (let i = 1; i < P - 1; i++) {
        const A = profile[0];
        const B = profile[i];
        const C = profile[i + 1];
        // Which way the fan's triangle faces, in 3D: its normal against the tangent.
        const ax = A[0] * s;
        const az = A[0] * c;
        const e1 = [B[0] * s - ax, B[1] - A[1], B[0] * c - az];
        const e2 = [C[0] * s - ax, C[1] - A[1], C[0] * c - az];
        const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        if (n[0] * tx + n[2] * tz >= 0) idx.push(base, base + i, base + i + 1);
        else idx.push(base, base + i + 1, base + i);
      }
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

/**
 * A slope of tiles over a four-sided quad (masonry.js tiledRoof: the eave's
 * two ends, then the top edge's) with the boards under it: the boards face
 * down, so the slope casts its shadow from both sides and is not see-through
 * from below. Returns { tile, wood }.
 */
export function roofSlope(quad, { lod = 0, seed = 1, pitch = 0.42 } = {}) {
  const t = tiledRoof(quad, { lod, seed, pitch });
  const g = new BufferGeometry();
  const q = quad.map(([x, y, z]) => [x, y - 0.03, z]);
  g.setAttribute('position', new Float32BufferAttribute([...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]], 3));
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) > 0) flipFaces(g);
  boxUV(g);
  return { tile: t.tiles, wood: [tintGeometry(g, () => 0.55)] };
}

/**
 * An Italian cypress (Cupressus sempervirens, planted by the Romans in
 * gardens, by tombs and in the groves of philosophers): a narrow flame of
 * dark foliage, lumpy, on a short trunk. `h` tall, its foot at (x, z).
 * Returns { leaf, wood }.
 */
export function cypress(x, z, h, { lod = 0, seed = 1 } = {}) {
  const rnd = artRng(seed);
  const r = h * 0.11;
  const steps = lod === 2 ? 4 : lod ? 7 : 12;
  const prof = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    // Widest a third of the way up, tapering to a point.
    const w = Math.sin(Math.min(1, t * 1.25 + 0.15) * Math.PI) ** 0.8 * (1 - t) ** 0.55;
    prof.push([Math.max(0.001, r * w * (k === 0 ? 0.6 : 1)), 0.35 + t * (h - 0.35)]);
  }
  prof[steps][0] = 0;
  prof.unshift([0, 0.35]);
  const ph = rnd() * 6;
  const lump = lod === 2 ? 0 : 0.18;
  const g = revolve(prof, {
    segments: lod === 2 ? 6 : lod ? 9 : 14,
    metres: 1,
    deform: (p, th) => {
      // Tufts: a few waves round it and up it.
      const k = 1 + lump * Math.sin(th * 5 + p.y * 3.1 + ph) * Math.sin(p.y * 4.3 + th * 2);
      p.x *= k;
      p.z *= k;
    },
    tint: (p) => {
      const a = Math.atan2(p.x, p.z);
      const v = 0.75 + 0.25 * Math.sin(a * 5 + p.y * 3.1 + ph);
      const top = Math.min(1, p.y / h);
      return [0.035 * v * (0.8 + 0.3 * top), 0.07 * v * (0.8 + 0.3 * top), 0.03 * v];
    },
  });
  g.translate(x, 0, z);
  const trunk = new CylinderGeometry(0.06, 0.09, 0.5, 6, 1).translate(x, 0.25, z);
  return { leaf: [g], wood: [tintGeometry(boxUV(trunk), () => 0.5)] };
}

/**
 * A shrub's crown (a laurel in a pot, a clipped bay): a ball of foliage,
 * lumpy but closed (its points welded before they are pushed about, so no
 * face comes away from its neighbours), shaded smooth. Radius r, its middle
 * at (x, y, z). Returns leaf geometries.
 */
export function bush(x, y, z, r, { lod = 0, seed = 1, squash = 1.15 } = {}) {
  let g = new IcosahedronGeometry(r, lod === 2 ? 1 : lod ? 2 : 3);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  const rnd = artRng(seed);
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i) / r;
    const vy = p.getY(i) / r;
    const vz = p.getZ(i) / r;
    // Clumps: a few waves over the ball's surface, bigger ones and smaller.
    const k = 1 + 0.13 * Math.sin(vx * 5 + ph[0]) * Math.sin(vy * 4 + ph[1]) + 0.08 * Math.sin(vz * 9 + vx * 7 + ph[2]);
    p.setXYZ(i, vx * r * k, vy * r * k * squash, vz * r * k);
  }
  g.computeVertexNormals();
  boxUV(g);
  g.translate(x, y, z);
  return [tintGeometry(g, (px, py, pz) => {
    const v = 0.8 + 0.2 * Math.sin(px * 13 + py * 11 + pz * 7);
    const top = Math.min(1, Math.max(0, (py - y + r) / (2 * r)));
    return [0.045 * v, (0.085 + 0.05 * top) * v, 0.032 * v];
  })];
}

/** Clipped box (buxus): a hedge over x0..x1, z0..z1, h high, lumpy at the full detail. Returns leaf geometries. */
export function hedge(x0, x1, z0, z1, h, { lod = 0, seed = 1 } = {}) {
  const g = slab(x1 - x0, h, z1 - z0, { bevel: 0.06, seed, wobble: lod ? 0 : 0.03, tilt: 0.04, tone: 0, grime: 0 });
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const rnd = artRng(seed + 5);
  const k = 0.85 + rnd() * 0.2;
  return [tintGeometry(g, (px, py) => [0.05 * k, 0.11 * k * (0.75 + 0.25 * Math.min(1, py / h)), 0.035 * k])];
}

export { box };
