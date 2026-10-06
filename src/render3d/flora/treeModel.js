/**
 * flora/treeModel.js
 * ----------------------------------------------------------------------------
 * A tree of the 3D countryside grown from its species (species.js), as a
 * group of meshes in metres (its foot at the origin, y up): bark (trunk,
 * limbs, branches, twigs as tapering tubes) and foliage (cards, each showing
 * a spray of leaves from surfacesFlora.js, cut out by its alpha).
 *
 * Silhouette first. Each species' crown has an envelope (ENVELOPES: the
 * cypress's flame, the stone pine's parasol, the holm oak's dome, the
 * poplar's tall oval, the pollard willow's mop) and the tree is grown into
 * it: the limbs head for points on the envelope round the trunk, their
 * branches for points near those, the twigs nearer still, and the foliage
 * clusters at the tips, so the outline is the species' whatever the seed.
 * A broad crown is left with gaps (the deciduous oak's) or packed with a
 * darker inner layer of sprays (`core`: the holm oak's, the cypress's
 * density), so light shows through where it does in nature.
 *
 * Foliage cards: each a spray from its texture's atlas, its foot at the
 * twig, turned outward and up, bent (two triangles a side at the full
 * level, folded along its twig), drawn from both sides with the crown's
 * outward normal (floraMaterials.js), coloured by the species and season in
 * its vertex colours and shaded darker toward the crown's middle and its
 * underside (the leaves shade each other). Levels of detail: 0 every twig
 * and small sprays; 1 the limbs and branches, sprays twice the size, a
 * quarter as many; the far level is an impostor (impostors.js) baked from
 * level 1.
 *
 * Looks (species.js lookOf): leaf, spring (young leaves, lighter, fewer),
 * autumn (the species' colours, thinning), bare (winter wood: every twig
 * shows), dead (the downy oak's dead leaves through the winter), blossom
 * (the cherry with its first leaves, the almond on bare wood), flower (the
 * myrtle's white flowers among its leaves).
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { limb } from '../models/orchard.js';
import { merge, triangles } from '../shapes.js';
import { artRng, smoothstep } from '../texgen.js';
import { lin } from '../models/rural.js';
import { SPECIES } from './species.js';
import { barkMaterial, foliageMaterial } from './floraMaterials.js';

/** The flora's sizes against nature's (species.js gives nature's, a little under): one knob for all. */
export const FLORA_SCALE = 0.8;

/**
 * The crowns' envelopes: radius(t) the crown's radius (a share of the
 * species' r) at height t (0 the crown's foot, 1 its top), and where the
 * crown starts and ends (shares of the tree's height).
 */
export const ENVELOPES = Object.freeze({
  // A flame: widest a quarter of the way up, drawn to a point.
  flame: { y0: 0.04, y1: 1, radius: (t) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.55) * 0.98 + 0.02)), 0.85) * (1 - t * 0.25) },
  // A parasol: a flat cushion on top, rounded at its rim.
  parasol: { y0: 0.66, y1: 1, radius: (t) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t * 2 - 1.15), 3)), 0.35) },
  dome: { y0: 0.22, y1: 1, radius: (t) => Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.42) / 0.58, 2))) },
  broad: { y0: 0.3, y1: 1, radius: (t) => Math.pow(Math.max(0, 1 - Math.pow((t - 0.45) / 0.55, 2)), 0.42) },
  'tall-dome': { y0: 0.3, y1: 1, radius: (t) => Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.45) / 0.55, 2))) },
  ovoid: { y0: 0.28, y1: 1, radius: (t) => Math.pow(Math.max(0, 1 - Math.pow((t - 0.42) / 0.58, 2)), 0.6) },
  mop: { y0: 0.42, y1: 1, radius: (t) => Math.pow(Math.max(0, 1 - Math.pow((t - 0.55) / 0.55, 2)), 0.5) },
  round: { y0: 0.25, y1: 1, radius: (t) => Math.pow(Math.max(0, 1 - Math.pow((t - 0.5) / 0.5, 2)), 0.55) },
  shrub: { y0: 0.05, y1: 1, radius: (t) => Math.pow(Math.max(0, 1 - Math.pow((t - 0.4) / 0.6, 2)), 0.5) },
  palm: { y0: 0.8, y1: 1, radius: () => 1 },
});

/** Sprays a square metre of crown at each level of detail, and their size against level 0's. */
const LOD_CARDS = [1.2, 0.3];
const LOD_SIZE = [1.25, 2.1];

const V = (x, y, z) => new Vector3(x, y, z);

/** An sRGB colour as linear [r, g, b], scaled to undo the spray textures' own pale grey (about 0.66 linear). */
const leafLin = (hex) => lin(hex, 1.5);

/** A bark tint (sRGB) as a multiplier about 1: the texture's own tone kept, its hue moved. */
function barkTint(hex) {
  const c = lin(hex);
  const l = (c[0] + c[1] + c[2]) / 3 || 1;
  // (Half the hue only: a tint, not a paint.)
  return c.map((v) => 0.5 + 0.5 * Math.min(1.6, (v / l) * 0.95));
}

/** The crown of species `s` at scale `k`: its centre's height, foot, top, radius and envelope. */
function crownOf(s, k) {
  const env = ENVELOPES[s.form];
  const H = s.size.h * k;
  const y0 = H * env.y0;
  const y1 = H * env.y1;
  return { env, H, y0, y1, R: s.size.r * k, cy: (y0 + y1) / 2 };
}

/** A point on the crown's envelope at azimuth `az`, height share `t`, a share `f` of the way out, made lumpy by `lump`. */
function onEnvelope(cr, az, t, f, lump = 0) {
  const r = cr.R * cr.env.radius(Math.min(1, Math.max(0, t))) * f * (1 + lump);
  return V(Math.cos(az) * r, cr.y0 + (cr.y1 - cr.y0) * t, Math.sin(az) * r);
}

/**
 * Grow the skeleton: limbs as point lists with radii and levels, and the
 * anchors where foliage clusters ({ p, out (outward), depth 0 at the
 * envelope, 1 deep inside }).
 */
function grow(sp, s, k, rnd, lod) {
  const cr = crownOf(s, k);
  const tr = s.trunk;
  const limbs = [];
  const anchors = [];
  const lumpA = rnd() * 6.28;
  const lump = (az) => (s.form === 'broad' ? 0.18 : s.form === 'flame' ? 0.04 : 0.1) * Math.sin(az * 3 + lumpA) + (rnd() - 0.5) * 0.08;
  // The trunk(s): to the clear height, leaning; a leader on through the crown for the excurrent trees.
  const trunkH = tr.leader ? cr.y1 * 0.94 : tr.h * k;
  const leanAz = rnd() * 6.28;
  const stems = [];
  for (let j = 0; j < tr.stems; j++) {
    const a = leanAz + (j / tr.stems) * 6.28 + (rnd() - 0.5) * 0.6;
    const lean = tr.stems > 1 ? 0.25 + rnd() * 0.15 : tr.lean * (0.6 + rnd() * 0.8);
    const h = trunkH * (tr.stems > 1 ? 0.85 + rnd() * 0.3 : 1);
    const foot = tr.stems > 1 ? [Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06] : [0, 0, 0];
    const tip = [foot[0] + Math.cos(a) * lean * h, h, foot[2] + Math.sin(a) * lean * h];
    // A crooked trunk (the oak's, the olive's) bends back along the way.
    const crook = (tr.gnarl || 0) * h * 0.25;
    const mid = [foot[0] + (tip[0] - foot[0]) * 0.45 + (rnd() - 0.5) * crook, h * 0.5, foot[2] + (tip[2] - foot[2]) * 0.45 + (rnd() - 0.5) * crook];
    const r0 = tr.r * k * (tr.stems > 1 ? 0.8 : 1);
    const pts = [[foot[0], -0.25, foot[2]], foot, mid, tip];
    if (tr.leader) pts.push([tip[0] * 1.05, cr.y1 * 0.99, tip[2] * 1.05]);
    stems.push({ pts, r0, r1: r0 * (tr.leader ? 0.12 : 0.62), level: 0, foot, tip });
  }
  for (const st of stems) limbs.push(st);
  const pointOn = (pts, t) => {
    // (Along a limb's polyline by its share of the points: near enough for where a branch starts.)
    const n = pts.length - 1;
    const x = Math.min(n - 1e-6, Math.max(0, t * n));
    const i = Math.floor(x);
    const f = x - i;
    return V(...pts[i]).lerp(V(...pts[i + 1]), f);
  };
  // The pollard's knob: where the lopped shoots spring from.
  if (tr.pollard) {
    const st = stems[0];
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * 6.28 + rnd();
      const b = [st.tip[0] + Math.cos(a) * 0.14 * k, st.tip[1] - 0.08, st.tip[2] + Math.sin(a) * 0.14 * k];
      limbs.push({ pts: [[st.tip[0], st.tip[1] - 0.35 * k, st.tip[2]], b], r0: tr.r * k * 0.95, r1: tr.r * k * 0.75, level: 1 });
    }
  }
  // Limbs: from the trunk's top (or along the leader), each toward a point of the envelope.
  const L1 = s.limbs;
  const golden = 2.39996;
  const az0 = rnd() * 6.28;
  for (let i = 0; i < L1.n; i++) {
    const st = stems[i % stems.length];
    const az = az0 + i * golden + (rnd() - 0.5) * 0.4;
    let from;
    let t;
    if (tr.leader) {
      // Along the leader from `from` of the crown up, the lowest limbs longest.
      const u = (i + 0.5) / L1.n;
      from = pointOn(st.pts.slice(1), (cr.y0 / cr.y1) * 0.9 + u * (0.98 - (cr.y0 / cr.y1) * 0.9));
      t = Math.min(0.97, (from.y - cr.y0) / (cr.y1 - cr.y0) + 0.06 + (1 - u) * 0.08 * L1.rise);
    } else if (tr.pollard) {
      from = V(st.tip[0] + Math.cos(az) * 0.12 * k, st.tip[1] - 0.02, st.tip[2] + Math.sin(az) * 0.12 * k);
      t = 0.55 + rnd() * 0.45;
    } else {
      const u = L1.from + (1 - L1.from) * rnd();
      from = pointOn(st.pts.slice(1), u);
      t = Math.min(0.95, 0.25 + L1.rise * 0.6 + (rnd() - 0.5) * 0.35);
    }
    const target = onEnvelope(cr, az, t, s.form === 'mop' ? 0.95 : 0.78 + rnd() * 0.12, lump(az));
    // The limb bows up toward the light (or, the pollard's straight shoots, hardly).
    const bow = L1.bow * from.distanceTo(target);
    const mid = from.clone().lerp(target, 0.5);
    mid.y += bow * 0.35;
    const r0 = tr.pollard ? 0.035 * k : (tr.leader ? tr.r * k * 0.32 : tr.r * k * 0.62) * (0.8 + rnd() * 0.3);
    const L = { pts: [from.toArray(), mid.toArray(), target.toArray()], r0, r1: r0 * 0.3, level: 1, az, t };
    limbs.push(L);
    // Branches off the limb, each toward the envelope near the limb's own point.
    const nb = s.twig.branches;
    for (let b = 0; b < nb; b++) {
      const u = 0.35 + 0.6 * ((b + 0.5) / nb) + (rnd() - 0.5) * 0.1;
      const p0 = pointOn(L.pts, u);
      const baz = az + (rnd() - 0.5) * (s.form === 'flame' ? 0.6 : 1.3);
      const bt = Math.min(1, Math.max(0, t + (rnd() - 0.35) * 0.3));
      const tip = onEnvelope(cr, baz, bt, 0.9 + rnd() * 0.12, lump(baz));
      // (Never back toward the trunk: a branch shorter than half a metre is a twig.)
      if (tip.distanceTo(p0) < 0.3 * k) tip.lerp(p0, -0.4);
      const bm = p0.clone().lerp(tip, 0.5);
      bm.y += 0.1 * p0.distanceTo(tip);
      const br = r0 * 0.45;
      limbs.push({ pts: [p0.toArray(), bm.toArray(), tip.toArray()], r0: br, r1: br * 0.35, level: 2 });
      anchors.push({ p: tip, depth: 0 });
      // Twigs: shorter, off the branch's outer half, to just inside the envelope.
      const nt = s.twig.twigs;
      for (let q = 0; q < nt; q++) {
        const v = 0.45 + 0.5 * ((q + 0.5) / nt);
        const t0 = V(...p0.toArray()).lerp(tip, v);
        const taz = baz + (rnd() - 0.5) * 0.9;
        const tt = Math.min(1, Math.max(0, bt + (rnd() - 0.5) * 0.25));
        const tw = onEnvelope(cr, taz, tt, 0.86 + rnd() * 0.16, lump(taz));
        // (A twig is short: at most 0.9 m.)
        const d = tw.distanceTo(t0);
        if (d > 0.9 * k) tw.lerp(t0, 1 - (0.9 * k) / d);
        if (lod === 0) limbs.push({ pts: [t0.toArray(), t0.clone().lerp(tw, 0.5).add(V(0, 0.05, 0)).toArray(), tw.toArray()], r0: br * 0.4, r1: 0.006, level: 3 });
        anchors.push({ p: tw, depth: 0 });
      }
    }
  }
  // The dense crowns' inner foliage: anchors deeper inside (darker sprays behind the outer ones).
  const nCore = Math.round(anchors.length * (s.leaf.core || 0) * 0.45);
  for (let i = 0; i < nCore; i++) {
    const az = rnd() * 6.28;
    const t = 0.1 + rnd() * 0.85;
    anchors.push({ p: onEnvelope(cr, az, t, 0.45 + rnd() * 0.3, 0), depth: 1 });
  }
  return { limbs, anchors, cr };
}

/** The cell of a spray texture's atlas a card shows, as its UV rectangle [u0, v0, u1, v1]. */
function cellUV(tex, i) {
  if (tex === 'leaf-frond') return [(i & 3) / 4, 0, ((i & 3) + 1) / 4, 1];
  const cx = i & 1;
  const cy = (i >> 1) & 1;
  return [cx / 2, cy / 2, (cx + 1) / 2, (cy + 1) / 2];
}

/**
 * Foliage cards as one geometry. `cards`: [{ p (its foot), dir (along the
 * spray, unit), side (across it, unit), size, cell, out (the crown's
 * normal there), c (linear colour) }]. `fold`: two triangles a side,
 * folded along the spray's twig (level 0), or one quad.
 */
export function cardGeometry(cards, tex, fold) {
  const pos = [];
  const nor = [];
  const col = [];
  const uv = [];
  const idx = [];
  const n = new Vector3();
  const tmp = new Vector3();
  for (const cd of cards) {
    const [u0, v0, u1, v1] = cellUV(tex, cd.cell);
    const um = (u0 + u1) / 2;
    const w = cd.width || cd.size;
    n.crossVectors(cd.side, cd.dir).normalize();
    // Its plane's normal, turned toward the crown's outward normal: the crown is lit as one mass.
    if (n.dot(cd.out) < 0) n.negate();
    const bent = tmp.copy(n).lerp(cd.out, 0.72).normalize();
    const base = pos.length / 3;
    const corner = (a, b, lift) => {
      // a across (-0.5..0.5), b along (0..1); lift: the fold's rise toward the normal.
      pos.push(
        cd.p.x + cd.side.x * a * w + cd.dir.x * b * cd.size + n.x * lift,
        cd.p.y + cd.side.y * a * w + cd.dir.y * b * cd.size + n.y * lift,
        cd.p.z + cd.side.z * a * w + cd.dir.z * b * cd.size + n.z * lift,
      );
      nor.push(bent.x, bent.y, bent.z);
      // The foot a little darker than the tip: the inside of the spray.
      const sh = 0.82 + 0.18 * b;
      col.push(cd.c[0] * sh, cd.c[1] * sh, cd.c[2] * sh);
      uv.push(um + a * (u1 - u0), v0 + b * (v1 - v0));
    };
    if (fold) {
      const lift = cd.size * 0.1;
      corner(-0.5, 0, 0); corner(0, 0, lift); corner(0.5, 0, 0);
      corner(-0.5, 1, 0); corner(0, 1, lift); corner(0.5, 1, 0);
      idx.push(base, base + 1, base + 4, base, base + 4, base + 3, base + 1, base + 2, base + 5, base + 1, base + 5, base + 4);
    } else {
      corner(-0.5, 0, 0); corner(0.5, 0, 0); corner(0.5, 1, 0); corner(-0.5, 1, 0);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** The foliage of a look: { count share, palette (sRGB), extra (blossom cards' share), dead share }. */
function foliageOf(s, look) {
  const c = s.colours;
  switch (look) {
    case 'bare': return { share: 0 };
    case 'spring': return { share: 0.62, palette: c.spring || c.leaf, size: 0.85 };
    case 'autumn': return { share: 0.8, palette: c.autumn || c.leaf, mixIn: c.leaf, mixShare: 0.15 };
    case 'dead': return { share: 0.45, palette: c.dead || c.autumn || c.leaf, size: 0.9 };
    case 'blossom': return s.colours.blossom ? { share: s === SPECIES.almond ? 0 : 0.28, palette: c.spring || c.leaf, size: 0.7, blossom: 0.9 } : { share: 0.62, palette: c.spring || c.leaf };
    case 'flower': return { share: 1, palette: c.leaf, blossom: 0.18 };
    default: return { share: 1, palette: c.leaf };
  }
}

/**
 * Grow a tree. `species` (species.js), `variant` (its shape: a seed),
 * `look`, `lod` (0 or 1). Returns { group, meshes, triangles, height,
 * radius } (metres, before the tile's scale).
 */
export function buildTree({ species = 'holm', variant = 0, look = 'leaf', lod = 0 } = {}) {
  const s = SPECIES[species];
  if (s.form === 'palm') return buildPalm({ variant, lod });
  const k = FLORA_SCALE;
  const rnd = artRng(1000 + variant * 7919 + species.length * 31 + species.charCodeAt(0));
  const group = new Group();
  group.name = `tree-${species}-${variant}-${look}-${lod}`;
  const meshes = [];
  const add = (g, mat, name) => {
    if (!g) return;
    const mesh = new Mesh(g, mat);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    meshes.push(mesh);
  };
  const { limbs, anchors, cr } = grow(species, s, k, rnd, lod);
  const fol = foliageOf(s, look);
  const bare = fol.share === 0 || look === 'dead' || look === 'blossom';
  // The wood. In winter (and under blossom) the twigs show at the middle level too, finer at the full.
  const wood = [];
  const tint = barkTint(s.bark.tex === 'bark' ? s.bark.tint : s.bark.tint);
  const twigTint = s.colours.twigs && bare ? lin(s.colours.twigs, 1.6) : null;
  for (const l of limbs) {
    if (lod === 1 && l.level > (bare ? 3 : 2)) continue;
    const radial = l.level === 0 ? (lod ? 7 : 11) : l.level === 1 ? (lod ? 5 : 7) : l.level === 2 ? (lod ? 3 : 5) : 3;
    const segs = l.level === 0 ? 0 : l.level >= 2 ? 2 : lod ? 3 : 0;
    let bump = null;
    if (l.level === 0) {
      // The foot flares into its roots; a gnarled stem is ridged and twisted.
      const g = s.trunk.gnarl || 0;
      const ph = rnd() * 6.28;
      bump = (t, a) => 0.55 * (1 - smoothstep(0, 0.14, t)) * (0.7 + 0.3 * Math.sin(a * 5 + ph)) + g * (0.2 * Math.sin(a * 3 + ph + t * 7) + 0.1 * Math.sin(a * 7 + t * 13));
    }
    const geo = limb(l.pts, Math.max(l.r0, 0.01), Math.max(l.r1, 0.004), { radial, segs, bump, twist: s.trunk.twist || 0 });
    // Bark colour: the species' tint, lighter up the tree, the twigs' own colour where they have one.
    const cAttr = geo.attributes.color;
    for (let i = 0; i < cAttr.count; i++) {
      const tw = twigTint && l.level >= 2 ? twigTint : tint;
      cAttr.setXYZ(i, cAttr.getX(i) * tw[0], cAttr.getY(i) * tw[1], cAttr.getZ(i) * tw[2]);
    }
    wood.push(geo);
  }
  // Bare wood's finer twigs (the crown's winter outline): a few at every anchor.
  if (bare && lod === 0) {
    for (const a of anchors) {
      if (a.depth > 0) continue;
      for (let j = 0; j < 3; j++) {
        const az = rnd() * 6.28;
        const L = 0.25 + rnd() * 0.35;
        const e = [a.p.x + Math.cos(az) * L * 0.7, a.p.y + L * (0.3 + rnd() * 0.5), a.p.z + Math.sin(az) * L * 0.7];
        const g = limb([a.p.toArray(), [(a.p.x + e[0]) / 2, (a.p.y + e[1]) / 2 + 0.03, (a.p.z + e[2]) / 2], e], 0.01, 0.004, { radial: 3, segs: 2 });
        const tw = twigTint || tint;
        const cAttr = g.attributes.color;
        for (let i = 0; i < cAttr.count; i++) cAttr.setXYZ(i, cAttr.getX(i) * tw[0], cAttr.getY(i) * tw[1], cAttr.getZ(i) * tw[2]);
        wood.push(g);
      }
    }
  }
  add(merge(wood), barkMaterial(species), 'bark');
  // The foliage.
  const leafCards = [];
  const flowerCards = [];
  const cards = Math.max(4, Math.round(crownArea(cr) * s.leaf.dens * LOD_CARDS[lod]));
  const size = s.leaf.card * LOD_SIZE[lod] * (fol.size || 1);
  const center = V(0, cr.cy, 0);
  const pal = (list) => leafLin(list[Math.floor(rnd() * list.length)]);
  const under = s.colours.under;
  // Where a spray grows: a third at the twigs' tips (the crown's structure), the rest spread over
  // the envelope's surface by its area (so the outline is full whatever the twigs reached), and in
  // the dense crowns a share deeper inside, darker. A broad crown keeps its gaps: patches of its
  // surface are left bare.
  const gapPh = rnd() * 6.28;
  const gappy = s.form === 'broad' || s.form === 'parasol' ? 0.5 : s.form === 'round' ? 0.75 : 2;
  const maxR = Math.max(...Array.from({ length: 16 }, (_, i) => cr.env.radius((i + 0.5) / 16)));
  const spot = () => {
    const u = rnd();
    if (u < 0.3 && anchors.length) return anchors[Math.floor(rnd() * anchors.length)];
    const deep = u > 1 - (s.leaf.core || 0) * 0.3;
    for (let tries = 0; tries < 12; tries++) {
      const t = rnd();
      if (rnd() * maxR > cr.env.radius(t)) continue;
      const az = rnd() * 6.28;
      if (Math.sin(az * 2 + gapPh) * Math.sin(t * 7 + gapPh * 2) > gappy) continue;
      return { p: onEnvelope(cr, az, t, deep ? 0.45 + rnd() * 0.3 : 0.8 + rnd() * 0.24, 0), depth: deep ? 1 : 0 };
    }
    return anchors[Math.floor(rnd() * anchors.length)] || { p: center.clone(), depth: 1 };
  };
  const place = (n, makeColour, into) => {
    for (let i = 0; i < n; i++) {
      const a = spot();
      into.push(card(a, cr, center, size * (0.8 + rnd() * 0.4) * (a.depth ? 0.85 : 1), rnd, makeColour(a), s));
    }
  };
  if (fol.share > 0) {
    const n = Math.round(cards * fol.share);
    // (The broad oak's crown has gaps: some anchors bare.)
    place(n, (a) => {
      let c = fol.mixIn && rnd() < fol.mixShare ? pal(fol.mixIn) : pal(fol.palette);
      // Undersides turned up by the wind: the poplar's and olive's silver, the holm oak's grey.
      if (under && rnd() < 0.22) c = pal(under);
      return shadeOf(c, a, cr);
    }, leafCards);
  }
  if (fol.blossom) {
    const n = Math.round(cards * fol.blossom);
    const bl = s.colours.blossom;
    place(n, (a) => shadeOf(leafLin(bl[Math.floor(rnd() * bl.length)]).map((v) => v * 0.68), a, cr, 0.55), flowerCards);
  }
  if (leafCards.length) add(cardGeometry(leafCards, s.leaf.tex, lod === 0), foliageMaterial(species, null, lod > 0), 'leaves');
  if (flowerCards.length) add(cardGeometry(flowerCards, 'leaf-blossom', lod === 0), foliageMaterial(species, 'leaf-blossom', lod > 0), 'blossom');
  let tris = 0;
  for (const m of meshes) tris += triangles(m.geometry);
  return { group, meshes, triangles: tris, height: cr.y1, radius: cr.R };
}

/** The crown's outer area (m^2): its envelope's surface, roughly, from a few rings. */
function crownArea(cr) {
  let a = 0;
  const N = 12;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const r = cr.R * cr.env.radius(t);
    a += 2 * Math.PI * r * ((cr.y1 - cr.y0) / N);
  }
  // (The top and bottom caps, as a disc each.)
  return a + Math.PI * cr.R * cr.R * 0.6;
}

/** A card at anchor `a`: its foot near the anchor, pointing outward and up, its plane facing out. */
function card(a, cr, center, size, rnd, c, s) {
  const out = a.p.clone().sub(center);
  out.y *= cr.R / Math.max(0.5, (cr.y1 - cr.y0) / 2);
  out.normalize();
  if (out.lengthSq() < 0.5) out.set(0, 1, 0);
  // Along the spray: outward and up, more up for the cypress's sprays, the pine's tufts.
  const up = s.form === 'flame' ? 0.8 : s.form === 'parasol' ? 0.55 : 0.35;
  const dir = out.clone().multiplyScalar(1 - up).add(V(0, up, 0)).add(V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.9)).normalize();
  // Across: square to the spray, turned at random about it, kept mostly facing outward.
  let side = V(0, 1, 0).cross(dir);
  if (side.lengthSq() < 1e-4) side = V(1, 0, 0);
  side.normalize();
  side.applyAxisAngle(dir, (rnd() - 0.5) * 1.6);
  // The foot pulled back a little into the crown: the spray grows from a twig behind it.
  const p = a.p.clone().addScaledVector(dir, -size * 0.3).add(V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(size * 0.4));
  return { p, dir, side, size, cell: Math.floor(rnd() * 4), out, c };
}

/**
 * A spray's colour shaded as the crown shades it: darker inside (the
 * anchor's depth) and toward the crown's foot, a little lighter on top.
 */
function shadeOf(c, a, cr, min = 0.45) {
  const t = (a.p.y - cr.y0) / Math.max(0.1, cr.y1 - cr.y0);
  const k = (a.depth ? 0.55 : 1) * (0.72 + 0.38 * smoothstep(0, 1, t));
  return c.map((v) => v * Math.max(min, k));
}

/**
 * The date palm: a slender trunk ringed by the bases of old fronds,
 * leaning and curving, a crown of fronds arching out and drooping (strips
 * of cards with the frond's texture along them), the oldest hanging dead
 * below, clusters of dates.
 */
export function buildPalm({ variant = 0, lod = 0 } = {}) {
  const s = SPECIES.palm;
  const k = FLORA_SCALE;
  const rnd = artRng(5003 + variant * 7919);
  const group = new Group();
  group.name = `tree-palm-${variant}-${lod}`;
  const meshes = [];
  const add = (g, mat, name) => {
    const mesh = new Mesh(g, mat);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    meshes.push(mesh);
  };
  const H = s.trunk.h * k * (0.9 + rnd() * 0.2);
  const lean = s.trunk.lean * (0.5 + rnd());
  const az = rnd() * 6.28;
  const top = V(Math.cos(az) * lean * H, H, Math.sin(az) * lean * H);
  const pts = [[0, -0.25, 0], [0, 0, 0], [top.x * 0.25, H * 0.5, top.z * 0.25], [top.x * 0.7, H * 0.85, top.z * 0.7], top.toArray()];
  // The rings: the trunk's radius stepped every 12 cm (each a frond's old base).
  const ring = (t, a) => 0.08 * Math.pow(Math.abs(Math.sin(t * H * 26)), 3) + 0.5 * (1 - smoothstep(0, 0.06, t)) * (1 + 0.2 * Math.sin(a * 6));
  const trunk = limb(pts, s.trunk.r * k * 1.25, s.trunk.r * k, { radial: lod ? 7 : 12, segs: lod ? 10 : 48, bump: ring });
  const tint = barkTint(s.bark.tint);
  const cAttr = trunk.attributes.color;
  for (let i = 0; i < cAttr.count; i++) cAttr.setXYZ(i, cAttr.getX(i) * tint[0], cAttr.getY(i) * tint[1], cAttr.getZ(i) * tint[2]);
  add(trunk, barkMaterial('palm'), 'bark');
  // The fronds: strips along a curve out and down from the crown, the leaflets the texture's.
  const fronds = [];
  const n = s.limbs.n;
  const L = s.leaf.card * k;
  for (let i = 0; i < n + 5; i++) {
    const dead = i >= n;
    const fa = az + i * 2.39996 + (rnd() - 0.5) * 0.3;
    // Young fronds stand up, old ones droop; the dead hang down the trunk.
    const rise = dead ? -1.1 - rnd() * 0.3 : 0.9 - (i / n) * 1.4 + (rnd() - 0.5) * 0.3;
    const len = L * (dead ? 0.8 : 0.85 + rnd() * 0.3);
    const segN = lod ? 3 : 7;
    const path = [];
    for (let j = 0; j <= segN; j++) {
      const t = j / segN;
      // An arch: out along the frond's heading, up by its rise, sagging toward its tip.
      const out = t * len * Math.cos(Math.atan(rise) * (1 - t * 0.5));
      const y = t * len * Math.sin(Math.atan(rise)) - t * t * len * (dead ? 0.1 : 0.32);
      path.push(V(top.x + Math.cos(fa) * out, top.y + y - (dead ? 0.15 : 0), top.z + Math.sin(fa) * out));
    }
    const colour = dead ? leafLin(s.colours.dead[i % 2]) : leafLin(s.colours.leaf[Math.floor(rnd() * 3)]).map((v) => v * (0.78 + rnd() * 0.3));
    fronds.push({ path, fa, colour, width: len * 0.25, cell: Math.floor(rnd() * 4), twist: (rnd() - 0.5) * 0.6 });
  }
  add(frondGeometry(fronds), foliageMaterial('palm', null, lod > 0), 'leaves');
  let tris = 0;
  for (const m of meshes) tris += triangles(m.geometry);
  return { group, meshes, triangles: tris, height: top.y + 1, radius: L };
}

/** The fronds as strips of quads along their paths, the frond texture's cell along each (v along it). */
function frondGeometry(fronds) {
  const pos = [];
  const nor = [];
  const col = [];
  const uv = [];
  const idx = [];
  for (const f of fronds) {
    const [u0, , u1] = cellUV('leaf-frond', f.cell);
    const N = f.path.length - 1;
    const base = pos.length / 3;
    for (let j = 0; j <= N; j++) {
      const p = f.path[j];
      const d = f.path[Math.min(N, j + 1)].clone().sub(f.path[Math.max(0, j - 1)]).normalize();
      // Across the frond: level, turned a little along it (the leaflets stand in a shallow V).
      const side = V(-Math.sin(f.fa), 0, Math.cos(f.fa)).applyAxisAngle(d, f.twist * (j / N));
      const up = side.clone().cross(d).normalize();
      if (up.y < 0) up.negate();
      for (const a of [-0.5, 0.5]) {
        pos.push(p.x + side.x * a * f.width + up.x * Math.abs(a) * f.width * 0.25, p.y + side.y * a * f.width + up.y * Math.abs(a) * f.width * 0.25, p.z + side.z * a * f.width + up.z * Math.abs(a) * f.width * 0.25);
        const nn = up.clone().lerp(V(0, 1, 0), 0.3).normalize();
        nor.push(nn.x, nn.y, nn.z);
        const sh = 0.75 + 0.25 * (j / N);
        col.push(f.colour[0] * sh, f.colour[1] * sh, f.colour[2] * sh);
        uv.push(a < 0 ? u0 : u1, j / N);
      }
      if (j < N) {
        const q = base + j * 2;
        idx.push(q, q + 1, q + 3, q, q + 3, q + 2);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
