/**
 * models/sacra.js
 * ----------------------------------------------------------------------------
 * What the temples, the oracle and the mission post of the 3D look share
 * for their rites (aedes.js, templum.js, tholus.js, sacellum.js):
 *
 *   - The altar (ara). A Roman sacrifice happened outside, at the altar in
 *     front of the temple's steps, not inside: the cella only housed the
 *     god. The altar is a block on a step, moulded at foot and top, two
 *     bolsters (pulvini) along its top, rolled like a scroll at their ends,
 *     the hearth (focus) between them; garlands carved on its sides.
 *   - The fire on it (staffed: the coals glowing, the flames' tongues, a
 *     thin smoke rising; unstaffed: cold ash), and the smoke as a kit of its
 *     own (an angry god's is dark and heavy).
 *   - Garlands (festoons) of leaves and flowers hung between the columns on
 *     a festival day. The people of a sacrifice (after the reliefs: the Ara
 *     Pacis's procession, the altar of Vicus Aesculeti, the suovetaurilia
 *     in the Louvre) are actors of the 3D look's people (people/; their
 *     places by state: aedes.js templeActors).
 *
 * Metres, y up, facing +z, as the other models.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import { revolve, profileOf, frameSweep, boxUV, tintGeometry, tube } from '../shapes.js';
import { material, surfaceTextures, LOOK } from '../materials.js';
import { artRng } from '../texgen.js';
import { slab, TaggedParts } from './masonry.js';
import { lin, D } from './rural.js';
import { box } from './castra.js';
import { govMaterials } from './domus.js';
import { healthMaterials, coals, plume, steamMaterial } from './healing.js';

export { box, D, lin };

/** The materials of the religious buildings: the senate's and the residences' (domus.js), the fire's, the paint's. */
export function sacraMaterials() {
  const m = govMaterials();
  return {
    ...m,
    // Painted plaster: the tympanum's ground and the frieze, their colours in the vertices (Roman temples were painted).
    painted: material('temple-paint', { surface: 'stucco', color: 0xffffff, vertexColors: true, snow: 0.6 }),
    terracotta: m.clay,
    // (Deeper than the beacons' flame: tone-mapped, a fire this size read as a pale yellow cone.)
    flame: material('altar-flame', { color: 0xff9a40, roughness: 1, emissive: 0xff5e14, emissiveIntensity: 2.4, snow: 0, wet: 0 }),
    embers: healthMaterials().embers,
    ash: material('cold-ash', { color: 0x4a4440, roughness: 0.95, snow: 1 }),
    // Garlands of laurel and myrtle, the farms' foliage (one program for every leaf).
    garland: material('foliage', { roughness: 0.7, snow: 0.85, wet: 0.6 }),
  };
}

// ---------------------------------------------------------------------------
// The altar and its fire
// ---------------------------------------------------------------------------

/**
 * An altar at (x, z) on the ground at y0: a step, the moulded foot, the die
 * w x d, h high in all, the crown, two bolsters along x at its top and the
 * hearth between them. Returns { stone (the step), marble (the altar),
 * hearth: [x, y, z] (the fire's foot), front: z of the die's face }.
 */
export function ara(x, z, { w = 1.1, d = 0.75, h = 0.95, y0 = 0, lod = 0, seed = 1, step = 0.12 } = {}) {
  const out = { stone: [], marble: [] };
  const hx = w / 2;
  const hz = d / 2;
  // The step it stands on, a hand's breadth all round.
  if (step > 0) out.stone.push(slab(w + 0.5, step, d + 0.5, { bevel: 0.015, seed, wobble: lod ? 0 : 0.003, tone: 0.03, grime: 0.3 }).translate(x, y0, z));
  const y1 = y0 + step;
  const foot = 0.16;
  const crown = 0.14;
  const die = h - foot - crown - 0.12;
  const m = Math.min(hx, hz) - 0.06;
  if (lod < 2) {
    out.marble.push(frameSweep(profileOf([[0.07, 0], [0.07, 0.06], { arc: [0.04, 0.09, 0.035, -Math.PI / 2, Math.PI / 2], n: lod ? 2 : 4 }, [0.0, foot], [-m, foot]]), hx - 0.07, hz - 0.07, { tint: (p) => 0.86 + 0.14 * Math.min(1, p.y / foot) }).translate(x, y1, z));
  } else {
    out.marble.push(slab(w, foot, d, { bevel: 0.01, seed: seed + 1, wobble: 0, tone: 0, grime: 0.2 }).translate(x, y1, z));
  }
  out.marble.push(slab(w - 0.14, die, d - 0.14, { bevel: 0.006, seed: seed + 2, wobble: 0, tone: 0.02, grime: 0.12 }).translate(x, y1 + foot, z));
  const yc = y1 + foot + die;
  if (lod < 2) {
    out.marble.push(frameSweep(profileOf([[0, 0], { arc: [0.03, 0.035, 0.03, Math.PI, Math.PI / 2], n: lod ? 2 : 4 }, [0.07, 0.07], [0.07, crown], [-m, crown]]), hx - 0.07, hz - 0.07).translate(x, yc, z));
  } else {
    out.marble.push(slab(w, crown, d, { bevel: 0.01, seed: seed + 3, wobble: 0, tone: 0, grime: 0 }).translate(x, yc, z));
  }
  const top = yc + crown;
  // The bolsters (pulvini) along the top's two ends, rolled at front and back.
  const r = Math.min(0.09, d * 0.14);
  for (const s of [-1, 1]) {
    const g = new CylinderGeometry(r, r, d - 0.02, lod === 2 ? 6 : lod ? 10 : 16, 1);
    g.rotateX(Math.PI / 2);
    g.translate(x + s * (hx - r - 0.02), top + r, z);
    out.marble.push(tintGeometry(boxUV(g), () => 0.95));
    if (lod === 0) {
      // The scroll's eye on each end, and the band tied round its middle.
      for (const e of [-1, 1]) {
        const eye = new TorusGeometry(r * 0.55, r * 0.16, 4, 12);
        eye.translate(x + s * (hx - r - 0.02), top + r, z + e * (d / 2 - 0.005));
        out.marble.push(tintGeometry(boxUV(eye), () => 0.85));
      }
      const band = new CylinderGeometry(r * 1.08, r * 1.08, 0.05, 12, 1);
      band.rotateX(Math.PI / 2);
      band.translate(x + s * (hx - r - 0.02), top + r, z);
      out.marble.push(tintGeometry(boxUV(band), () => 0.88));
    }
  }
  // The hearth: a shallow bowl let into the top between the bolsters.
  const hr = Math.min(hx - 2 * r - 0.06, hz - 0.08);
  out.marble.push(revolve(profileOf([[hr, 0], [hr, 0.04], [hr - 0.03, 0.04], [hr * 0.6, 0.0], [0, 0.0]]), { segments: lod ? 10 : 18, metres: 0.5, tint: () => 0.7 }).translate(x, top, z));
  if (lod === 0) {
    // A garland carved on each side face, swinging from the corners, with its ribbons.
    for (const s of [-1, 1]) {
      const px = x + s * (hx - 0.07 + 0.012);
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        pts.push([px, yc - 0.06 - Math.sin(Math.PI * t) * die * 0.38, z - (hz - 0.13) + t * 2 * (hz - 0.13)]);
      }
      out.marble.push(tube(pts, 0.03, { radial: 5, segments: 12, around: 0.2 }));
    }
  }
  return { ...out, hearth: [x, top + 0.02, z], top, front: z + hz - 0.07 };
}

/**
 * The fire on a hearth at [x, y, z], `r` across: the coals (`hot` glowing
 * while the fire is in, `dark` charcoal always), the flames' tongues and
 * the cold ash shown when it is out. Returns { hot, dark, flames, ash }.
 */
export function hearthFire([x, y, z], r = 0.2, { lod = 0, seed = 1, big = 1 } = {}) {
  const c = coals(x, y, z, r, { seed, lod });
  const out = { hot: c.hot, dark: c.dark, flames: [], ash: [] };
  const seg = lod ? 5 : 7;
  const rows = lod ? 3 : 6;
  // Tongues of flame: thin, of mixed heights, each licking up in a wave and leaning out from the
  // middle (a single cone read as a lampshade); the tallest in the middle.
  const tongues = [[0, 0, 0.46, 0.085], [0.07, 0.04, 0.34, 0.06], [-0.06, -0.05, 0.36, 0.06], [0.03, -0.08, 0.27, 0.05], [-0.06, 0.07, 0.3, 0.05], [0.09, -0.03, 0.22, 0.045], [-0.02, 0.09, 0.24, 0.045]];
  tongues.forEach(([dx, dz, h, rr], k) => {
    if (lod && k > 2) return;
    const H = h * big;
    const f = new CylinderGeometry(0, rr * big * 1.2, H, seg, rows, true);
    const P = f.attributes.position;
    const ph = k * 1.9 + seed;
    for (let i = 0; i < P.count; i++) {
      const t = P.getY(i) / H + 0.5;
      // Swelling a third of the way up, waving side to side as it rises.
      const swell = 1 + 0.35 * Math.sin(Math.PI * Math.min(1, t * 1.4));
      P.setXYZ(i, P.getX(i) * swell + Math.sin(t * 5 + ph) * 0.025 * big * t, P.getY(i), P.getZ(i) * swell + Math.cos(t * 4 + ph) * 0.02 * big * t);
    }
    f.computeVertexNormals();
    f.rotateZ(dx * 2.2);
    f.rotateX(-dz * 2.2);
    f.translate(x + dx * big, y + 0.03 + H / 2, z + dz * big);
    out.flames.push(tintGeometry(boxUV(f), (px, py) => 1 - 0.45 * Math.min(1, (py - y) / H)));
  });
  const ash = revolve(profileOf([[0, 0], [r * 0.95, 0], [r * 0.7, 0.03], [r * 0.3, 0.05], [0, 0.055]]), { segments: lod ? 8 : 14, metres: 0.4 });
  out.ash.push(ash.translate(x, y, z));
  return out;
}

/**
 * The smoke of an altar, standing on the origin: `kind` 'thin' (a working
 * temple's offering: incense, a little fat on the fire, grey-white and
 * thin), 'thick' (a festival's sacrifice: more of it, taller) or 'wrath'
 * (a god angry with the city: dark, heavy, leaning low). A kit of its own
 * (see-through), placed over the hearth by the matrix of `more`.
 */
export function buildSmoke(kind = 'thin', lod = 0) {
  const p = new TaggedParts(`smoke-${kind}`);
  const cols = lod === 2 ? 3 : lod ? 4 : 6;
  const rows = lod === 2 ? 4 : lod ? 6 : 9;
  const opt = {
    thin: { h: 2.4, r: 0.1, n: lod ? 2 : 3, rgb: [0.95, 0.94, 0.92], alpha: 0.55, lean: [0.35, 0.2] },
    thick: { h: 3.4, r: 0.16, n: lod ? 2 : 4, rgb: [0.92, 0.9, 0.88], alpha: 0.7, lean: [0.55, 0.3] },
    // (Leaning back over the steps, not out over the street: a plume must stay over its own footprint.)
    wrath: { h: 3.8, r: 0.26, n: lod ? 3 : 5, rgb: [1, 1, 1], alpha: 1, lean: [0.6, -0.45] },
    // The breath of an oracle's cleft: pale, low and wide, hanging over the rock.
    vapour: { h: 1.5, r: 0.2, n: lod ? 2 : 3, rgb: [0.98, 0.98, 0.97], alpha: 0.38, lean: [0.2, 0.25] },
  }[kind];
  // (The wrath's smoke takes a material of its own, dark through: on the steam's white the vertex
  // colour's darkening came out a pale haze over a white temple, not the omen it should be.)
  const mat = kind === 'wrath' ? darkSmokeMaterial() : steamMaterial();
  const g = plume(0, 0, 0, { ...opt, rgb: kind === 'wrath' ? [1, 1, 1] : opt.rgb, cols, rows, seed: kind.length * 7 });
  // A soot cloud is dense where steam is thin: its alpha lifted (clamped), so it reads over a white
  // temple from the game's height, not only against the sky.
  if (kind === 'wrath') {
    const c = g.attributes.color;
    for (let i = 0; i < c.count; i++) c.setW(i, Math.min(1, c.getW(i) * 2.8));
  }
  p.add('smoke', mat, g, { cast: false });
  return p.build().group;
}

/** The see-through material of an angry god's smoke: the steam's (healing.js steamMaterial), soot-dark. */
export function darkSmokeMaterial() {
  const m = material('altar-smoke-dark', { color: 0x0b0a09, roughness: 1, opacity: 0.95, snow: 0, wet: 0 });
  if (m.userData.steam) return m;
  m.userData.steam = true;
  const nm = surfaceTextures('ripples', 'steam').normalMap;
  m.normalMap = nm;
  m.normalScale.set(1.2, 1.2);
  m.onBeforeRender = () => {
    const t = LOOK.uniforms.uLookTime.value;
    nm.offset.set(Math.sin(t * 0.11) * 0.4, -t * 0.16);
  };
  return m;
}

// ---------------------------------------------------------------------------
// Garlands
// ---------------------------------------------------------------------------

/**
 * A festoon of leaves hung from a to b ([x, y, z]), sagging `sag` at its
 * middle, `r` thick (fattest at the middle, as a garland is bound), flowers
 * in it close up and ribbons from its ends. Returns { leaf, flowers }.
 */
export function festoon(a, b, { sag = 0.35, r = 0.06, lod = 0, seed = 1, colours = null } = {}) {
  const n = lod ? 6 : 12;
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t]);
  }
  const g = tube(pts, r, { radial: lod ? 4 : 6, segments: lod ? 8 : 20, around: 0.2 });
  const rnd = artRng(seed);
  // (Its leaves' tones speckled through it, laurel dark and myrtle light.)
  const leaf = [tintGeometry(g, (px, py, pz) => {
    const v = 0.75 + 0.25 * Math.sin(px * 31 + py * 27 + pz * 19);
    return [0.05 * v, 0.13 * v, 0.04 * v];
  })];
  const flowers = [];
  if (lod === 0) {
    const pal = colours || [lin(0xc8343a), lin(0xe8dcd0), lin(0xe0b040)];
    for (let k = 1; k < n; k++) {
      const [px, py, pz] = pts[k];
      const f = new SphereGeometry(r * 0.55, 5, 3);
      f.translate(px + (rnd() - 0.5) * r, py - r * 0.5, pz + r * 0.8);
      const c = pal[k % pal.length];
      flowers.push(tintGeometry(boxUV(f), () => c));
    }
  }
  return { leaf, flowers };
}

/** A plain box geometry helper re-exported for the builders: a BoxGeometry turned about y. */
export function turnedBox(w, h, d, x, y, z, ry, k = 1) {
  const g = new BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  g.rotateY(ry);
  g.translate(x, y, z);
  return tintGeometry(boxUV(g), typeof k === 'function' ? k : () => k);
}
