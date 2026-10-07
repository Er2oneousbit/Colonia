/**
 * models/fornix.js
 * ----------------------------------------------------------------------------
 * The triumphal arch of the 3D look (3 x 3, 12 m, across a road), designed
 * from the arches that stand, the Arch of Titus at the top of the Via
 * Sacra above all, rather than from the sprite:
 *
 *   - One bay between two piers of Pentelic marble on a plinth, the faces
 *     framed by engaged Composite columns (Titus's is the first known use
 *     of the order) on their bases, fluted.
 *   - Round the arch an archivolt, its keystone carved as a console with a
 *     figure; in the spandrels winged Victories flying in toward it with
 *     wreaths and palms.
 *   - Inside the passage the two great reliefs of the triumph (the
 *     procession with the spoils carried high on litters), framed, under
 *     the plain round vault.
 *   - The entablature with its frieze and a cornice on dentils; above it
 *     the attic with the inscription, SENATVS POPVLVSQVE ROMANVS and the
 *     emperor's name, in letters of gilt bronze set into it (the holes of
 *     such letters are still read on the arches of Septimius Severus and
 *     Orange); and on top, as the coins that show these arches show, the
 *     victor in a four-horse chariot (quadriga) in gilt bronze, a Victory
 *     behind him holding a wreath over his head.
 *
 * Built with its road along x (the passage open from -x to +x, its faces
 * looking along the road); models/decor.js turns it a quarter for a road
 * along the map's y. The six tiles beside the road are paved in travertine
 * with a kerb along it; the road's own tiles are left to the game's road,
 * which runs on under it.
 *
 * Metres, the footprint's middle at the origin, y up. Levels of detail 0
 * to 2.
 * ----------------------------------------------------------------------------
 */

import { Shape, ExtrudeGeometry, BoxGeometry, CylinderGeometry, Matrix4 } from 'three';
import { revolve, profileOf, frameSweep, boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { smoothstep, artRng } from '../texgen.js';
import { slab, paving, TaggedParts } from './masonry.js';
import { castraMaterials } from './castra.js';
import { person } from './learning.js';
import { horse, figure, victory, carve, textWidth, ellipsoid, loft } from './statuary.js';

/** The arch's measures (metres): the tests, the lab and the game read them. */
export const FORNIX = Object.freeze({
  /** The body's half depth along the road and half width across it; the bay's half width. */
  hx: 1.8,
  hz: 4.7,
  bay: 1.8,
  /** The plinth's top, the arch's springing, its crown; the entablature's foot, the attic's foot and top. */
  plinth: 0.8,
  impost: 3.9,
  entab: 6.4,
  attic: 7.4,
  top: 9.4,
  /** The road's half width (the paving stops at it). */
  road: 1.95,
});

const F = FORNIX;

/** The inscription, after the Arch of Titus's (by the Senate and People of Rome) with the emperor's name and the cause. */
export const ARCH_TEXT = Object.freeze(['SENATVS', 'POPVLVSQVE·ROMANVS', 'IMP·CAESARI·AVGVSTO', 'OB·VICTORIAM']);

/** Turn a geometry built in (along the road, up, across) = (x, y, z) about y by a, into the bins. */
const turned = (g, a) => (a ? g.rotateY(a) : g);

/**
 * The body: both piers and the span over the bay as one extruded face
 * (the passage's walls and its round vault come with it), from the plinth's
 * top to the entablature's foot.
 */
function body(lod) {
  // The outline walks round the bay (a notch from the foot, not a hole: a hole touching the outline
  // is not cut by the triangulation).
  const shape = new Shape();
  shape.moveTo(-F.hz, F.plinth);
  shape.lineTo(-F.bay, F.plinth);
  shape.lineTo(-F.bay, F.impost);
  shape.absarc(0, F.impost, F.bay, Math.PI, 0, true);
  shape.lineTo(F.bay, F.plinth);
  shape.lineTo(F.hz, F.plinth);
  shape.lineTo(F.hz, F.entab);
  shape.lineTo(-F.hz, F.entab);
  shape.lineTo(-F.hz, F.plinth);
  const g = new ExtrudeGeometry(shape, { depth: 2 * F.hx, bevelEnabled: false, curveSegments: lod === 2 ? 6 : lod ? 14 : 28 });
  // Shape (z, y), extruded along its z: turn so the extrusion runs along x, the shape across z.
  g.rotateY(Math.PI / 2);
  g.translate(-F.hx, 0, 0);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  boxUV(g);
  return tintGeometry(g, (x, y, z) => {
    // The passage's inside darker (the vault's shade), grime at the foot.
    const inside = Math.abs(z) < F.bay + 0.01 ? 0.78 : 1;
    return inside * (0.82 + 0.18 * smoothstep(F.plinth, F.plinth + 1.2, y));
  });
}

/** A fluted engaged column with its Attic base and Composite capital, from y0 to y1, its axis at (x, z), the wall behind it at -x (sx). */
function column(x, z, y0, y1, r, lod) {
  const out = [];
  const seg = lod === 2 ? 8 : lod ? 14 : 28;
  const capH = r * 2.1;
  const baseH = r * 0.9;
  // The base: plinth, two tori and a scotia.
  out.push(revolve(profileOf([[0, 0], [r * 1.45, 0], [r * 1.45, r * 0.22], { arc: [r * 1.3, r * 0.38, r * 0.16, -Math.PI / 2, Math.PI / 2], n: lod ? 2 : 5 }, [r * 1.14, r * 0.58], [r * 1.16, r * 0.66], { arc: [r * 1.12, r * 0.76, r * 0.1, -Math.PI / 2, Math.PI / 2], n: lod ? 2 : 4 }, [r * 1.02, r * 0.9], [0, r * 0.9]]), { segments: seg, metres: 1 }).translate(x, y0, z));
  // The shaft: tapering a little, fluted (24 flutes) at the full level.
  const shaftH = y1 - y0 - baseH - capH;
  const shaft = revolve(profileOf([[r, 0], [r * 0.98, shaftH * 0.33], [r * 0.88, shaftH], [0, shaftH]]), {
    segments: lod ? seg : 96, metres: 1,
    deform: lod ? null : (p, th) => {
      const k = 1 - 0.045 * Math.pow(Math.abs(Math.cos(th * 12)), 0.6) * (p.y < shaftH - 0.01 ? 1 : 0);
      p.x *= k;
      p.z *= k;
    },
    tint: (p, th) => (lod ? 1 : 0.88 + 0.12 * Math.abs(Math.cos(th * 12))),
  });
  out.push(shaft.translate(x, y0 + baseH, z));
  // The capital: a bell with two rows of acanthus leaves, volutes at its corners, the abacus.
  const cy = y1 - capH;
  out.push(revolve(profileOf([[r * 0.88, 0], [r * 0.9, capH * 0.15], [r * 1.05, capH * 0.6], [r * 1.25, capH * 0.82], [0, capH * 0.82]]), {
    segments: seg, metres: 1,
    deform: lod === 2 ? null : (p, th) => {
      // The leaves: lobes round the bell in two rows, curling out at their tips.
      const row = p.y < capH * 0.45 ? 0 : 1;
      const k = 1 + 0.12 * Math.max(0, Math.cos(th * 8 + row * Math.PI / 8)) * smoothstep(capH * 0.1, capH * 0.6, p.y);
      p.x *= k;
      p.z *= k;
    },
    tint: (p) => 0.85 + 0.15 * smoothstep(0, capH * 0.8, p.y),
  }).translate(x, cy, z));
  if (lod < 2) {
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) out.push(ellipsoid(r * 0.28, 1, 1, 0.7, x + dx * r * 1.05, cy + capH * 0.78, z + dz * r * 1.05, 8, 6));
  }
  out.push(slab(r * 2.9, capH * 0.18, r * 2.9, { bevel: 0.02, seed: 3, wobble: 0, tone: 0, grime: 0 }).translate(x, cy + capH * 0.82, z));
  return out;
}

/** A Victory in relief on a face, flying: the statuette flattened, turned to lie along the face, her body slanting. */
function reliefVictory(cx, cy, cz, faceX, lean, s, lod) {
  const out = [];
  const m = new Matrix4().makeScale(s, s, s * 0.18);
  m.premultiply(new Matrix4().makeRotationZ(lean));
  // Built facing +z: turn her to face out of the +x face (or -x).
  m.premultiply(new Matrix4().makeRotationY(faceX > 0 ? Math.PI / 2 : -Math.PI / 2));
  m.premultiply(new Matrix4().makeTranslation(cx, cy, cz));
  for (const g of victory(lod, { scale: 1 })) out.push(g.applyMatrix4(m));
  return out;
}

/**
 * A relief panel inside the passage, on the wall at z = side * bay facing
 * the passage: a frame and the procession in it (figures in low relief,
 * the spoils carried high on litters, a placard naming the conquered).
 */
function passageRelief(side, lod, m) {
  const out = { marble: [], relief: [] };
  const z = side * F.bay;
  const y0 = F.plinth + 0.9;
  const y1 = F.impost - 0.25;
  const x0 = -F.hx + 0.35;
  const x1 = F.hx - 0.35;
  const into = -side;
  // The frame: a moulded border standing out of the wall.
  for (const [a, b, c, d] of [[x0, x1, y0, y0 + 0.1], [x0, x1, y1 - 0.1, y1], [x0, x0 + 0.1, y0, y1], [x1 - 0.1, x1, y0, y1]]) {
    out.marble.push(tintGeometry(boxUV(new BoxGeometry(b - a, d - c, 0.08).translate((a + b) / 2, (c + d) / 2, z + into * 0.04)), () => 0.95));
  }
  if (lod > 0) return out;
  // The procession: men in low relief walking toward the road's +x, bearing the spoils.
  const mats = { cloth: 'm', skin: 'm', hair: 'm', leather: 'm' };
  const n = 6;
  for (let k = 0; k < n; k++) {
    const x = x0 + 0.35 + (k * (x1 - x0 - 0.7)) / (n - 1);
    const parts = person(mats, { long: k % 3 === 0, arms: k % 2 ? 'hold' : 'down', cloth: 0xffffff }, 0, 0, 0, 0, 0.62);
    for (const p of parts) {
      // Flattened against the wall, walking along +x.
      const g = p.g;
      g.rotateY(Math.PI / 2);
      g.scale(1, 1, 0.22);
      g.translate(x, y0 + 0.12, z + into * 0.1);
      // (In stone: the figure's own colours, its skin and hair, are the marble's now.)
      tintGeometry(g, (px, py) => 0.8 + 0.2 * smoothstep(y0, y0 + 1.2, py));
      out.relief.push(g);
    }
    if (k % 2) {
      // A litter (ferculum) carried high: the spoils on it.
      out.relief.push(tintGeometry(boxUV(new BoxGeometry(0.55, 0.05, 0.08).translate(x + 0.05, y0 + 0.9, z + into * 0.1))));
      out.relief.push(tintGeometry(boxUV(new BoxGeometry(0.2, 0.22, 0.06).translate(x + 0.05, y0 + 1.04, z + into * 0.1))));
    }
  }
  return out;
}

/** The quadriga on the attic: four horses abreast, the chariot, the victor, a Victory crowning him. Gilt bronze. */
function quadriga(y, lod) {
  const out = [];
  const s = 0.88;
  for (const [k, z] of [-0.96, -0.32, 0.32, 0.96].entries()) {
    const hz = horse({ lod, pose: 'draw', turnHead: (k - 1.5) * 0.12, cloth: false });
    // Built facing +z: turned to face +x, out over the arch's front.
    const m = new Matrix4().makeScale(s, s, s).premultiply(new Matrix4().makeRotationY(Math.PI / 2)).premultiply(new Matrix4().makeTranslation(0.55, y, z));
    for (const g of hz.body) out.push(g.applyMatrix4(m));
  }
  // The chariot: a curved tub on two spoked wheels, behind the team.
  const cx = -0.75;
  const tub = loft([[y + 0.55, cx, 0, 0.45, 0.62], [y + 1.25, cx - 0.04, 0, 0.5, 0.66]], { seg: lod ? 12 : 24, a0: Math.PI * 0.1, a1: Math.PI * 1.9, caps: false });
  out.push(tub);
  if (lod < 2) {
    for (const sz of [-1, 1]) {
      const wheel = new CylinderGeometry(0.5, 0.5, 0.06, lod ? 12 : 20, 1, true);
      wheel.rotateX(Math.PI / 2);
      wheel.translate(cx, y + 0.5, sz * 0.72);
      out.push(tintGeometry(boxUV(wheel)));
      for (let k = 0; k < (lod ? 4 : 8); k++) {
        const sp = new BoxGeometry(0.035, 0.96, 0.035).rotateZ((k * Math.PI) / (lod ? 4 : 8)).translate(cx, y + 0.5, sz * 0.72);
        out.push(tintGeometry(boxUV(sp)));
      }
    }
  }
  // The victor, robed, his right hand raised; the Victory behind him with her wreath.
  const f = figure('toga', { lod, wreath: true });
  const vm = new Matrix4().makeScale(1.05, 1.05, 1.05).premultiply(new Matrix4().makeRotationY(Math.PI / 2)).premultiply(new Matrix4().makeTranslation(cx, y + 0.6, 0));
  for (const list of Object.values(f)) for (const g of list) out.push(g.applyMatrix4(vm));
  if (lod < 2) {
    const nm = new Matrix4().makeScale(1.35, 1.35, 1.35).premultiply(new Matrix4().makeRotationY(Math.PI / 2)).premultiply(new Matrix4().makeTranslation(cx - 0.5, y + 0.62, 0.15));
    for (const g of victory(lod, { scale: 1 })) out.push(g.applyMatrix4(nm));
  }
  return out;
}

/** Build the arch, its road along x: { group, meshes, triangles }. */
export function buildArch({ lod = 0, seed = 523 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = { marble: [], plinth: [], paving: [], letters: [], gilt: [], relief: [], dark: [] };
  const rnd = artRng(seed);
  // The paving either side of the road, its kerb.
  for (const s of [-1, 1]) {
    out.paving.push(...paving(-5.9, 5.9, s > 0 ? F.road + 0.18 : -5.9, s > 0 ? 5.9 : -F.road - 0.18, 0.08, seed + s, { rowW: 0.7, minL: 0.6, maxL: 1.2, lod, tone: 0.06, grime: 0.2 }));
    out.plinth.push(slab(11.8, 0.16, 0.18, { bevel: 0.01, seed: seed + 3 + s, wobble: 0, tone: 0.02, grime: 0.3 }).translate(0, 0, s * (F.road + 0.09)));
  }
  // The plinths under the piers, with their mouldings.
  for (const s of [-1, 1]) {
    const cz = s * (F.bay + F.hz) / 2;
    const hz = (F.hz - F.bay) / 2;
    const p = frameSweep(profileOf([[0.32, 0], [0.32, 0.16], [0.26, 0.2], [0.26, F.plinth - 0.2], [0.3, F.plinth - 0.14], [0.3, F.plinth - 0.06], [0.16, F.plinth], [-Math.min(F.hx, hz), F.plinth]]), F.hx, hz, {
      tint: (q) => 0.78 + 0.22 * smoothstep(0, 0.5, q.y),
    });
    out.plinth.push(p.translate(0, 0.08, cz));
  }
  out.marble.push(body(lod).translate(0, 0.08, 0));
  // Columns: two on each pier, on each face.
  const r = 0.3;
  for (const sx of [-1, 1]) {
    for (const z of [F.bay + 0.55, F.hz - 0.5, -(F.bay + 0.55), -(F.hz - 0.5)]) {
      out.marble.push(...column(sx * (F.hx + 0.1), z, F.plinth + 0.08, F.entab + 0.08, r, lod));
    }
  }
  // The archivolt round the bay on each face, the keystone, the impost mouldings.
  for (const sx of [-1, 1]) {
    const ring = new CylinderGeometry(F.bay + 0.32, F.bay + 0.32, 0.14, lod === 2 ? 8 : lod ? 16 : 32, 1, true, 0, Math.PI);
    ring.rotateZ(Math.PI / 2);
    ring.translate(sx * (F.hx + 0.07), F.impost + 0.08, 0);
    if (lod < 2) out.marble.push(tintGeometry(boxUV(ring), () => 0.92));
    // The keystone: a console standing out of the face, a figure on it.
    out.marble.push(slab(0.18, 0.75, 0.42, { bevel: 0.02, seed: seed + 9, wobble: 0, tone: 0, grime: 0 }).translate(sx * (F.hx + 0.09), F.impost + F.bay - 0.2, 0));
    if (lod === 0) {
      const v = victory(lod, { scale: 0.5 });
      for (const g of v) out.marble.push(g.applyMatrix4(new Matrix4().makeScale(1, 1, 0.3).premultiply(new Matrix4().makeRotationY(sx * Math.PI / 2)).premultiply(new Matrix4().makeTranslation(sx * (F.hx + 0.2), F.impost + F.bay - 0.05, 0))));
    }
    // Impost mouldings on the piers' passage faces, at the springing.
    for (const sz of [-1, 1]) out.marble.push(slab(2 * F.hx + 0.02, 0.18, 0.08, { bevel: 0.01, seed: seed + 11, wobble: 0, tone: 0, grime: 0 }).translate(0, F.impost + 0.08 - 0.18, sz * (F.bay - 0.03)));
    // The spandrels' Victories, flying in toward the keystone.
    if (lod < 2) {
      for (const sz of [-1, 1]) out.marble.push(...reliefVictory(sx * (F.hx + 0.03), F.impost + 1.55, sz * 1.65, sx, sz * 1.15, 1.15, lod));
    }
    // A panel framed on each pier's face between its columns.
    if (lod < 2) {
      for (const sz of [-1, 1]) {
        const cz = sz * (F.bay + F.hz) / 2 + sz * 0.02;
        for (const [w, h, dy, dz] of [[0.08, 2.2, 0, -0.62], [0.08, 2.2, 0, 0.62], [0.08, 0.08, 1.1, 0], [0.08, 0.08, -1.1, 0]]) {
          const g = new BoxGeometry(w, h, dy === 0 ? 0.08 : 1.32);
          g.translate(sx * (F.hx + 0.04), F.plinth + 0.08 + 2.0 + dy, cz + dz);
          out.marble.push(tintGeometry(boxUV(g), () => 0.9));
        }
      }
    }
  }
  // Inside the passage: the reliefs of the triumph.
  for (const side of [-1, 1]) {
    const pr = passageRelief(side, lod);
    out.marble.push(...pr.marble.map((g) => g.translate(0, 0.08, 0)));
    out.relief.push(...pr.relief.map((g) => g.translate(0, 0.08, 0)));
  }
  // The entablature: architrave, frieze, a cornice on dentils, round the whole body.
  const e0 = F.entab + 0.08;
  out.marble.push(frameSweep(profileOf([[0.42, 0], [0.42, 0.12], [0.46, 0.13], [0.46, 0.24], [0.5, 0.25], [0.5, 0.36], [0.42, 0.4], [0.42, 0.68], [0.47, 0.72], { arc: [0.54, 0.74, 0.06, Math.PI, Math.PI / 2], n: lod ? 2 : 4 }, [0.8, 0.82], [0.8, 0.94], [0.74, 1.0], [-F.hx, 1.0]]), F.hx, F.hz, {
    tint: (q) => (q.y - e0 > 0.38 && q.y - e0 < 0.7 ? 0.9 : 1),
  }).translate(0, e0, 0));
  if (lod === 0) {
    // Dentils under the corona, all round.
    const d = 0.18;
    for (const [len, along] of [[2 * F.hx, 'x'], [2 * F.hz, 'z']]) {
      const n = Math.floor(len / d);
      for (let k = 0; k < n; k++) {
        const a = -len / 2 + (k + 0.5) * d;
        for (const s of [-1, 1]) {
          const g = new BoxGeometry(along === 'x' ? 0.09 : 0.12, 0.1, along === 'x' ? 0.12 : 0.09);
          g.translate(along === 'x' ? a : s * (F.hx + 0.52), e0 + 0.76, along === 'x' ? s * (F.hz + 0.52) : a);
          out.marble.push(tintGeometry(boxUV(g), () => 0.88));
        }
      }
    }
  }
  // The attic, its inscription in gilt bronze on both faces, its cornice.
  const a0 = F.attic + 0.08;
  const ah = F.top - F.attic;
  out.marble.push(slab(2 * F.hx + 0.1, ah, 2 * F.hz + 0.1, { bevel: 0.02, seed: seed + 20, wobble: 0, tone: 0, grime: 0.1 }).translate(0, a0, 0));
  out.marble.push(frameSweep(profileOf([[0.05, 0], [0.1, 0.05], [0.18, 0.12], [0.18, 0.22], [-F.hx, 0.22]]), F.hx + 0.05, F.hz + 0.05).translate(0, a0 + ah, 0));
  for (const sx of [-1, 1]) {
    // The panel's frame, then the letters set in it.
    const fw = 2 * F.hz - 1.2;
    const fh = ah - 0.45;
    const fy = a0 + 0.22;
    const fx = sx * (F.hx + 0.06);
    for (const [w, h, y, z] of [[fw, 0.08, fy, 0], [fw, 0.08, fy + fh - 0.08, 0], [0.08, fh, fy, -fw / 2], [0.08, fh, fy, fw / 2]]) {
      out.marble.push(tintGeometry(boxUV(new BoxGeometry(0.05, h, w).translate(fx + sx * 0.02, y + h / 2, z)), () => 0.95));
    }
    if (lod === 0) {
      // Line by line down the panel, the first (SENATVS) largest, as on the Arch of Titus.
      const sizes = [0.3, 0.22, 0.22, 0.2];
      let y = fy + fh - 0.16;
      ARCH_TEXT.forEach((t, i) => {
        const hh = Math.min(sizes[i], (fw - 0.4) / textWidth(t, 1));
        y -= hh + (i ? 0.1 : 0);
        for (const g of carve(t, y, 0, hh, { depth: 0.03 })) {
          g.rotateY(sx * Math.PI / 2);
          g.translate(fx + sx * 0.012, 0, 0);
          out.letters.push(g);
        }
      });
    } else if (lod === 1) {
      out.letters.push(tintGeometry(boxUV(new BoxGeometry(0.02, fh * 0.6, fw * 0.75).translate(fx + sx * 0.015, fy + fh * 0.2, 0))));
    }
  }
  // The quadriga on top.
  out.gilt.push(...quadriga(a0 + ah + 0.22, lod));
  void rnd;
  const m = castraMaterials();
  const p = new TaggedParts('triumphal_arch');
  p.add('paving', m.trav, out.paving, { cast: false });
  p.add('plinth', m.trav, out.plinth);
  p.add('marble', material('arch-marble', { surface: 'marble', color: 0xf4efe6, vertexColors: true, snow: 1 }), [...out.marble, ...out.relief]);
  p.add('letters', material('gilt-leaf', { color: 0xe0b45e, metalness: 1, roughness: 0.32, vertexColors: true, snow: 0.5 }), out.letters, { cast: false });
  p.add('quadriga', material('gilt-leaf', { color: 0xe0b45e, metalness: 1, roughness: 0.32, vertexColors: true, snow: 0.5 }), out.gilt);
  return p.build();
}
