/**
 * models/prefecture.js
 * ----------------------------------------------------------------------------
 * The prefecture of the 3D look: a watch house of the vigiles (an
 * excubitorium) on one 4 m tile, from what is known of Rome's watch and
 * fire brigade rather than from the 2D sprite:
 *
 *   - Augustus raised the vigiles in AD 6: seven cohorts of freedmen, each
 *     keeping two of the city's fourteen regions from a barracks (statio)
 *     and smaller watch posts (excubitoria). The excubitorium of the
 *     seventh cohort in Trastevere, dug up in 1866, was a house taken over
 *     by the watch: brick walls, a court with a basin, a shrine (lararium)
 *     to the post's guardian spirit, and the men's graffiti on its walls,
 *     many about the sebaciaria, the duty of keeping the lamps and torches
 *     lit on the night watch.
 *   - Their kit, as the jurists and inscriptions name it: buckets (hamae)
 *     of rope sealed with pitch, force pumps (siphones, the two-cylinder
 *     pump Vitruvius credits to Ctesibius, as in the wooden one from
 *     Silchester), blankets (centones) to smother flames, axes and picks
 *     (dolabrae), ladders, and hooks on long poles to pull down a burning
 *     roof before the fire could spread.
 *
 * So, on a 4 m tile: a small watch house of brick (opus testaceum) on a
 * travertine socle under a tiled gable roof; a studded double door framed
 * in travertine, a marble plaque over it cut VIGILES, COH VII in red; to
 * the left a rack of pitched buckets, a barred window; to the right the
 * lararium in its painted niche, the lantern on its bracket, a bench with
 * folded centones; along the side wall the ladder, the hook and the axes;
 * in the forecourt the pump standing in its water tank.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed, the crew at home: doors open, the kit racked, a man at
 *           the door and one at the pump, two buckets filled by it
 *   'out'   some of the crew at a fire (sim/risk.js; staffed, or men still
 *           fighting one after the post lost its staff): the doors
 *           open, the bucket rack, the ladder, the hook, the axes and the
 *           blankets gone with them, one man left at the door
 *   'shut'  no staff: the doors shut, the kit racked, nobody, the lantern out
 * Tags: 'staffed' (open or out), 'home' (open or shut: the kit racked).
 *
 * Metres, the tile's middle at the origin, y up, the front (the door, the
 * street it faces) toward +z, as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, TorusGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { material, waterMaterial } from '../materials.js';
import { artRng } from '../texgen.js';
import { slab, paving, wallWithOpenings, lantern, lanternPane, inscription, TaggedParts } from './masonry.js';
import { gableRoof, ladder, doorLeaf, beam, lin, D } from './rural.js';
import { figureParts } from './figure.js';

/** The watch house's measures (metres): the tests, the lab and the game read them. */
export const PREFECTURE = Object.freeze({
  half: 2,
  floorY: 0.06, // the forecourt's flags
  // The house's outer faces: the back of the tile, with the forecourt before it.
  x0: -1.75,
  x1: 1.15,
  z0: -1.72,
  z1: 0.18,
  socle: 0.36, // the travertine socle's top: the door's threshold
  wall: 0.34,
  eave: 3.4,
  door: Object.freeze({ x: -0.35, w: 1.0, h: 1.95 }),
  /** The pump's tank (x0, x1, z0, z1, its rim's height). */
  tank: Object.freeze([-1.62, -0.78, 0.78, 1.34, 0.5]),
  /** The lantern by the door (x, y, z): the game's night lights it while staffed (models.js modelLamps). */
  lamp: Object.freeze([0.42, 1.98, 0.46]),
});

const P = PREFECTURE;

/** A box w x h x d, its foot at (x, y, z): UVs in metres, a vertex colour of `k`. */
function box(w, h, d, x, y, z, k = 1) {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return tintGeometry(boxUV(g), () => k);
}

/** A cylinder (radii rt, rb, height h) standing on (x, y, z). */
function cyl(rt, rb, h, seg, x, y, z, k = 1) {
  const g = new CylinderGeometry(rt, rb, h, seg, 1);
  g.translate(x, y + h / 2, z);
  return tintGeometry(boxUV(g), () => k);
}

/**
 * A fire bucket (hama): a tapered pail of coiled rope sealed with pitch,
 * its rope bail. Standing on y 0, the bail up (its top 0.42 m over the
 * foot: where it hangs from a peg). Returns { body, bail }.
 */
export function hama(lod = 0) {
  const seg = lod === 0 ? 16 : lod === 1 ? 9 : 6;
  // Up the outside, over a rolled rim, down the inside to a thick bottom; the inside darker.
  const body = revolve(profileOf([[0, 0], [0.088, 0], [0.094, 0.012], [0.114, 0.25], [0.124, 0.268], [0.118, 0.282], [0.104, 0.27], [0.086, 0.04], [0, 0.04]]), {
    segments: seg,
    metres: 0.12,
    tint: (p) => (Math.hypot(p.x, p.z) < 0.106 && p.y > 0.035 ? 0.45 : 0.8 + 0.2 * Math.min(1, p.y / 0.25)),
  });
  let bail = null;
  if (lod < 2) {
    bail = tube([[-0.12, 0.25, 0], [-0.1, 0.34, 0], [-0.04, 0.41, 0], [0.04, 0.41, 0], [0.1, 0.34, 0], [0.12, 0.25, 0]], 0.009, { radial: lod ? 3 : 5, segments: lod ? 6 : 12, around: 0.06 });
  }
  return { body, bail };
}

/** The pump's water, kept by name so the game can freeze it in a hard frost (models/services.js). */
export const PUMP_WATER = 'tank-water';

/** The house: socle, brick walls with the door, window and niche, the roof, the dark inside, the doors open and shut. */
function house(lod, seed, out) {
  const { x0, x1, z0, z1, socle, wall: t, eave, door } = P;
  const W = x1 - x0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const rnd = artRng(seed);
  // The socle: travertine blocks of seeded lengths round the house, a little proud of the wall; the threshold whole.
  const proud = 0.035;
  const course = (axis, a, b, at, skip) => {
    let p = a;
    if (lod === 2) {
      out.trav.push(axis === 'x' ? slab(b - a, socle - P.floorY, t + 2 * proud, { bevel: 0.01, seed: seed + at * 9, wobble: 0, tone: 0, grime: 0.3 }).translate((a + b) / 2, P.floorY, at)
        : slab(t + 2 * proud, socle - P.floorY, b - a, { bevel: 0.01, seed: seed + at * 9, wobble: 0, tone: 0, grime: 0.3 }).translate(at, P.floorY, (a + b) / 2));
      return;
    }
    while (b - p > 0.04) {
      let q = Math.min(b, p + 0.55 + rnd() * 0.5);
      if (b - q < 0.25) q = b;
      if (skip && q > skip[0] && p < skip[1]) q = Math.min(q, skip[0]);
      if (q - p > 0.03) {
        const h = socle - P.floorY;
        const g = axis === 'x'
          ? slab(q - p - 0.008, h, t + 2 * proud, { bevel: 0.014, seed: seed + 100 + p * 31, wobble: 0.003, tone: 0.06, grime: 0.35 }).translate((p + q) / 2, P.floorY, at)
          : slab(t + 2 * proud, h, q - p - 0.008, { bevel: 0.014, seed: seed + 100 + p * 31, wobble: 0.003, tone: 0.06, grime: 0.35 }).translate(at, P.floorY, (p + q) / 2);
        out.trav.push(g);
      }
      p = skip && q === skip[0] ? skip[1] : q;
    }
  };
  const dx0 = door.x - door.w / 2 - 0.12;
  const dx1 = door.x + door.w / 2 + 0.12;
  course('x', x0 - proud, x1 + proud, z1 - t / 2, [dx0, dx1]);
  course('x', x0 - proud, x1 + proud, z0 + t / 2);
  course('z', z0 + t + proud, z1 - t - proud, x0 + t / 2);
  course('z', z0 + t + proud, z1 - t - proud, x1 - t / 2);
  // The threshold, worn in the middle, and the step up to it from the forecourt.
  out.trav.push(slab(dx1 - dx0, socle - P.floorY, t + 2 * proud, { bevel: 0.02, seed: seed + 7, wobble: 0.002, tone: 0.03, grime: 0.2 }).translate((dx0 + dx1) / 2, P.floorY, z1 - t / 2));
  out.trav.push(slab(door.w + 0.5, 0.15, 0.34, { bevel: 0.025, seed: seed + 8, wobble: 0.004, tone: 0.05, grime: 0.35 }).translate(door.x, P.floorY, z1 + 0.17 + proud));
  // The walls: the front with its door, window and the lararium's niche; the back and the ends plain.
  const winX = -1.22;
  const niche = { x: 0.8, y: 1.12, w: 0.36, h: 0.34 };
  const front = wallWithOpenings(W, eave - socle, t, [
    { x: door.x - cx, w: door.w, h: door.h },
    { x: winX - cx, y: 1.46, w: 0.42, h: 0.5 },
    { x: niche.x - cx, y: niche.y, w: niche.w, h: niche.h, arch: true },
  ], { lod, y0: socle });
  boxUV(front, cx, 0);
  out.brick.push(front.translate(cx, 0, z1));
  out.brick.push(boxUV(slab(W, eave - socle, t, { bevel: 0.004, seed, wobble: 0, tone: 0, grime: 0.15 }), 0, 0).translate(cx, socle, z0 + t / 2));
  for (const s of [-1, 1]) {
    const x = s < 0 ? x0 + t / 2 : x1 - t / 2;
    out.brick.push(boxUV(slab(t, eave - socle, z1 - z0 - 2 * t + 0.002, { bevel: 0.004, seed: seed + s, wobble: 0, tone: 0, grime: 0.15 })).translate(x, socle, cz));
    // The gable over it: a triangle of brick up under the ridge.
    const span = z1 - z0;
    const rise = (span / 2) * Math.tan(D(24));
    const g = new BoxGeometry(t, rise, span, 1, 1, 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const top = pos.getY(i) > 0;
      pos.setY(i, top ? rise * (1 - Math.abs(pos.getZ(i)) / (span / 2)) : 0);
    }
    g.computeVertexNormals();
    g.translate(x, eave, cz);
    out.brick.push(tintGeometry(boxUV(g)));
  }
  // A brick cornice under the eaves of the front and back: two courses stepping out.
  if (lod < 2) {
    for (const z of [z1, z0]) {
      const s = z === z1 ? 1 : -1;
      out.brick.push(boxUV(slab(W + 0.06, 0.07, 0.06, { bevel: 0.006, seed: seed + 30 + s, wobble: 0, tone: 0, grime: 0 })).translate(cx, eave - 0.2, z + s * 0.03));
      out.brick.push(boxUV(slab(W + 0.12, 0.07, 0.1, { bevel: 0.006, seed: seed + 31 + s, wobble: 0, tone: 0, grime: 0 })).translate(cx, eave - 0.13, z + s * 0.05));
    }
  }
  // The dark inside, seen through the open door and the window: a box turned inside out.
  const room = new BoxGeometry(W - 2 * t - 0.02, eave - socle - 0.1, z1 - z0 - 2 * t - 0.02);
  const idx = room.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const k = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = k;
  }
  room.translate(cx, socle + (eave - socle - 0.1) / 2 + 0.005, cz);
  room.computeVertexNormals();
  out.dark.push(tintGeometry(boxUV(room)));
  // The door's travertine frame: jambs, a lintel, the doors (two leaves: shut, or swung in against the jambs).
  const zf = z1;
  for (const s of [-1, 1]) out.trav.push(slab(0.14, door.h, t + 0.07, { bevel: 0.01, seed: seed + 40 + s, wobble: 0.002, tone: 0.04, grime: 0.25 }).translate(door.x + s * (door.w / 2 + 0.07), socle, zf - t / 2 + 0.035));
  out.trav.push(slab(door.w + 0.42, 0.2, t + 0.1, { bevel: 0.012, seed: seed + 43, wobble: 0.002, tone: 0.04, grime: 0 }).translate(door.x, socle + door.h, zf - t / 2 + 0.05));
  const leafW = door.w / 2;
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const leaf = doorLeaf(leafW - 0.012, door.h - 0.03, seed + 50 + s, lod);
      // (doorLeaf is centred on x: its hinge edge to x = 0, the left leaf toward +x, the right toward -x.)
      leaf.translate(-s * leafW / 2, 0, 0);
      leaf.rotateY(open ? -s * D(98) : 0);
      leaf.translate(door.x + s * (door.w / 2), socle + 0.015, zf - t + 0.07);
      (open ? out.doorOpen : out.doorShut).push(leaf);
      if (lod === 0) {
        // Iron studs in rows across the shut leaf's face (on the open leaf, turned with it).
        for (const yy of [0.25, 0.95, 1.65]) {
          for (const xx of [0.1, 0.25, 0.4]) {
            const st = new CylinderGeometry(0.013, 0.017, 0.012, 6);
            st.rotateX(Math.PI / 2);
            st.translate(-s * xx, yy, 0.03);
            st.rotateY(open ? -s * D(98) : 0);
            st.translate(door.x + s * (door.w / 2), socle + 0.015, zf - t + 0.07);
            (open ? out.studsOpen : out.studsShut).push(tintGeometry(boxUV(st)));
          }
        }
      }
    }
  }
  // The window: a travertine sill and head, three iron bars.
  const wy = socle + 1.46;
  out.trav.push(slab(0.56, 0.06, t + 0.08, { bevel: 0.008, seed: seed + 60, wobble: 0.002, tone: 0.03, grime: 0.15 }).translate(winX, wy - 0.06, zf - t / 2 + 0.04));
  out.trav.push(slab(0.56, 0.1, t + 0.04, { bevel: 0.008, seed: seed + 61, wobble: 0.002, tone: 0.03, grime: 0 }).translate(winX, wy + 0.5, zf - t / 2 + 0.02));
  if (lod < 2) for (const bx of [-0.12, 0, 0.12]) out.iron.push(cyl(0.011, 0.011, 0.5, 5, winX + bx, wy, zf - 0.09));
  // The lararium: the niche lined in red, a sill, little pilasters and a pediment round it (a painted aedicula).
  const ny = socle + niche.y;
  out.red.push(box(niche.w + 0.02, niche.h + niche.w / 2 + 0.02, 0.02, niche.x, ny - 0.01, zf - 0.14));
  out.trav.push(slab(niche.w + 0.16, 0.05, 0.2, { bevel: 0.008, seed: seed + 70, wobble: 0.001, tone: 0, grime: 0 }).translate(niche.x, ny - 0.05, zf - 0.06));
  if (lod < 2) {
    for (const s of [-1, 1]) out.plaster.push(box(0.05, niche.h + 0.12, 0.025, niche.x + s * (niche.w / 2 + 0.04), ny, zf + 0.012));
    // The pediment: a low triangle over the arch.
    const pw = niche.w / 2 + 0.11;
    const py = ny + niche.h + niche.w / 2 + 0.02;
    const g = new BufferGeometry();
    const q = [[niche.x - pw, py, zf + 0.025], [niche.x + pw, py, zf + 0.025], [niche.x, py + 0.12, zf + 0.025]];
    g.setAttribute('position', new Float32BufferAttribute(q.flat(), 3));
    g.computeVertexNormals();
    out.plaster.push(tintGeometry(boxUV(g)));
    out.plaster.push(box(2 * pw + 0.02, 0.025, 0.04, niche.x, py - 0.025, zf + 0.012));
  }
  if (lod === 0) {
    // In it: a little altar and the two Lares, bronze statuettes pouring from their horns.
    out.trav.push(box(0.08, 0.11, 0.06, niche.x, ny, zf - 0.09));
    for (const s of [-1, 1]) {
      const lar = revolve(profileOf([[0, 0], [0.02, 0], [0.016, 0.05], [0.022, 0.09], [0.012, 0.11], [0.014, 0.13], [0, 0.14]]), { segments: 6, metres: 0.1 });
      out.bronze.push(lar.translate(niche.x + s * 0.1, ny, zf - 0.08));
    }
  }
  // The plaque over the door: VIGILES and the cohort's number, cut and painted red.
  const plY = socle + door.h + 0.25;
  out.marble.push(slab(1.06, 0.4, 0.035, { bevel: 0.006, seed: seed + 80, wobble: 0, tone: 0, grime: 0.05 }).translate(door.x, plY, zf + 0.012));
  if (lod === 0) {
    out.letters.push(...inscription('VIGILES', plY + 0.19, zf + 0.031, 0.15).map((g) => g.translate(door.x, 0, 0)));
    out.letters.push(...inscription('COH·VII', plY + 0.055, zf + 0.031, 0.095).map((g) => g.translate(door.x, 0, 0)));
  } else if (lod === 1) {
    out.letters.push(box(0.74, 0.12, 0.006, door.x, plY + 0.2, zf + 0.03));
    out.letters.push(box(0.46, 0.08, 0.006, door.x, plY + 0.06, zf + 0.03));
  }
  // The roof: a tiled gable, its ridge along the front, the eaves over the forecourt and the back.
  const roof = gableRoof({ x0, x1, z0, z1, eaveY: eave, pitch: D(24), along: 'x', lod, seed: seed + 90, over: 0.22, gableOver: 0.18 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
}

/** The kit: the bucket rack, the ladder, hook and axes on the side wall, the rope, the bench and the blankets. */
function kit(lod, seed, out) {
  const { x1, z0, z1, socle } = P;
  const zf = z1;
  // The bucket rack: a board on the front wall left of the door, three iron pegs, a pitched bucket on each.
  const rackY = socle + 1.33;
  out.wood.push(slab(0.8, 0.11, 0.04, { bevel: 0.008, seed: seed + 1, wobble: 0.002, tone: 0.05, grime: 0 }).translate(-1.29, rackY - 0.05, zf + 0.02));
  const pegs = [-1.54, -1.29, -1.04];
  for (const px of pegs) {
    const peg = new CylinderGeometry(0.012, 0.014, 0.18, lod ? 4 : 6);
    peg.rotateX(Math.PI / 2 - 0.25);
    peg.translate(px, rackY + 0.02, zf + 0.1);
    out.iron.push(tintGeometry(boxUV(peg)));
    const h = hama(lod);
    const at = (g) => g.clone().translate(px, rackY - 0.4, zf + 0.165);
    out.bucketsHome.push(at(h.body));
    if (h.bail) out.bailsHome.push(at(h.bail));
  }
  // Along the side wall (+x, which the game's camera sees): the ladder on two hooks, the long fire hook over it, two axes.
  const xs = x1 + 0.035;
  if (lod < 2) {
    for (const z of [-1.25, -0.25]) {
      out.iron.push(tube([[x1, socle + 0.55, z], [xs + 0.06, socle + 0.55, z], [xs + 0.08, socle + 0.6, z]], 0.012, { radial: 4, segments: 4, around: 0.1 }));
    }
  }
  const lad = ladder(1.85, 0, seed + 3, lod);
  // (Built standing in x-y: its length turned onto z, its width up the wall.)
  lad.rotateX(Math.PI / 2);
  lad.rotateZ(Math.PI / 2);
  lad.translate(xs + 0.03, socle + 0.78, -1.62);
  out.ladder.push(lad);
  // The hook (uncus) on a long pole, its iron head toward the street; it rests on two pegs.
  const hy = socle + 1.42;
  out.hook.push(beam([xs + 0.04, hy, -1.9], [xs + 0.04, hy, 0.45], 0.05, seed + 5, lod));
  if (lod < 2) {
    out.hookIron.push(tube([[xs + 0.04, hy, 0.4], [xs + 0.04, hy, 0.66]], 0.016, { radial: 5, segments: 2, around: 0.1 }));
    out.hookIron.push(tube([[xs + 0.04, hy + 0.01, 0.5], [xs + 0.04, hy + 0.1, 0.58], [xs + 0.04, hy + 0.16, 0.52], [xs + 0.04, hy + 0.13, 0.43]], 0.014, { radial: 5, segments: lod ? 5 : 10, around: 0.1 }));
    // (It rests on two iron pegs out of the wall.)
    for (const z of [-1.4, -0.3]) out.iron.push(tube([[x1, hy - 0.035, z], [xs + 0.09, hy - 0.035, z]], 0.01, { radial: 4, segments: 1, around: 0.1 }));
  }
  // Two dolabrae (an axe's blade on one side of the head, a pick on the other), hung head up.
  if (lod < 2) {
    for (const [z, k] of [[-1.05, 0], [-0.62, 1]]) {
      const hx = xs + 0.03;
      const top = socle + 2.25;
      out.axeWood.push(beam([hx, top - 0.68, z], [hx, top, z], 0.034, seed + 10 + k, lod));
      // The head across the top of the haft, along z: the blade toward the street, the pick behind.
      out.axeIron.push(box(0.04, 0.05, 0.13, hx, top - 0.05, z));
      const blade = new BufferGeometry();
      const by = top - 0.03;
      const bz = z + 0.065;
      blade.setAttribute('position', new Float32BufferAttribute([
        hx - 0.012, by + 0.015, bz, hx - 0.012, by - 0.02, bz, hx - 0.012, by - 0.07, bz + 0.12, hx - 0.012, by + 0.05, bz + 0.12,
        hx + 0.012, by + 0.015, bz, hx + 0.012, by - 0.07, bz + 0.12, hx + 0.012, by - 0.02, bz, hx + 0.012, by + 0.05, bz + 0.12,
      ], 3));
      blade.setIndex([0, 1, 2, 0, 2, 3, 4, 7, 5, 4, 5, 6, 3, 2, 5, 3, 5, 7]);
      blade.computeVertexNormals();
      out.axeIron.push(tintGeometry(boxUV(blade)));
      out.axeIron.push(tube([[hx, by, z - 0.06], [hx, by - 0.02, z - 0.14], [hx, by - 0.06, z - 0.2]], 0.012, { radial: 4, segments: 4, around: 0.1 }));
      // (Hung by its head over a peg either side of the haft.)
      for (const s of [-1, 1]) out.iron.push(tube([[x1, top - 0.065, z + s * 0.045], [xs + 0.07, top - 0.065, z + s * 0.045]], 0.008, { radial: 4, segments: 1, around: 0.1 }));
    }
    // A coil of rope on a peg by the front corner.
    for (let k = 0; k < 3; k++) {
      const c = new TorusGeometry(0.15 - k * 0.006, 0.018, lod ? 4 : 6, lod ? 12 : 22);
      c.rotateY(Math.PI / 2);
      c.translate(xs + 0.03 + k * 0.025, socle + 1.78 - k * 0.01, 0.0 + k * 0.012);
      out.rope.push(tintGeometry(boxUV(c), () => 0.9 - k * 0.08));
    }
  }
  // The bench by the door: a board on two travertine blocks; the centones folded on it, ready.
  const bx = 0.66;
  const bz = zf + 0.4;
  for (const s of [-1, 1]) out.trav.push(slab(0.1, 0.38, 0.3, { bevel: 0.012, seed: seed + 20 + s, wobble: 0.003, tone: 0.05, grime: 0.35 }).translate(bx + s * 0.28, P.floorY, bz));
  out.wood.push(slab(0.76, 0.05, 0.34, { bevel: 0.01, seed: seed + 23, wobble: 0.002, tone: 0.06, grime: 0 }).translate(bx, P.floorY + 0.38, bz));
  const seat = P.floorY + 0.43;
  const patches = [lin(0x8a3b2c), lin(0x5a5048), lin(0x9b8a62), lin(0x4b5a62), lin(0x7a6248), lin(0xa8956c)];
  const rnd = artRng(seed + 30);
  for (let k = 0; k < (lod === 2 ? 1 : 3); k++) {
    const g = slab(0.42 - k * 0.02, lod === 2 ? 0.16 : 0.055, 0.28, { bevel: 0.02, seed: seed + 31 + k, wobble: 0.01, tone: 0, grime: 0 });
    const off = (rnd() - 0.5) * 0.04;
    g.translate(bx - 0.1 + off, seat + k * 0.055, bz + (rnd() - 0.5) * 0.03);
    // A patchwork: each patch of the blanket its own cloth (vertex colours over the wool).
    const ph = rnd() * 9;
    out.centones.push(tintGeometry(g, (x, y, z) => {
      const i = Math.abs(Math.floor(x / 0.09 + ph) * 7 + Math.floor(z / 0.08) * 13 + k * 5) % patches.length;
      return patches[i];
    }));
  }
}

/** The pump (siphon) in its tank, after the two-cylinder force pump: the block, the rods, the rocking beam, the pipe and nozzle. */
function pump(lod, seed, out) {
  const [tx0, tx1, tz0, tz1, rimY] = P.tank;
  const cx = (tx0 + tx1) / 2;
  const cz = (tz0 + tz1) / 2;
  const w = tx1 - tx0;
  const d = tz1 - tz0;
  const y0 = P.floorY;
  const h = rimY - y0;
  const pl = 0.045;
  // The tank: planks, corner posts, iron bands; water nearly to the rim.
  out.wood.push(slab(w, 0.05, d, { bevel: 0.006, seed: seed + 1, wobble: 0, tone: 0.05, grime: 0.3 }).translate(cx, y0, cz));
  for (const s of [-1, 1]) {
    out.wood.push(slab(w, h, pl, { bevel: 0.008, seed: seed + 2 + s, wobble: 0.002, tone: 0.06, grime: 0.4 }).translate(cx, y0, cz + s * (d / 2 - pl / 2)));
    out.wood.push(slab(pl, h, d - 2 * pl, { bevel: 0.008, seed: seed + 4 + s, wobble: 0.002, tone: 0.06, grime: 0.4 }).translate(cx + s * (w / 2 - pl / 2), y0, cz));
  }
  if (lod < 2) {
    for (const yy of [0.1, h - 0.12]) {
      const band = new BoxGeometry(w + 0.012, 0.035, d + 0.012);
      band.translate(cx, y0 + yy, cz);
      out.iron.push(tintGeometry(boxUV(band), () => 0.85));
    }
  }
  const water = new BoxGeometry(w - 2 * pl, 0.02, d - 2 * pl);
  water.translate(cx, rimY - 0.07, cz);
  out.water.push(tintGeometry(boxUV(water)));
  // The pump's block (oak, as the Silchester one), standing in the water, its two bronze-lined bores at the top.
  const bY = rimY - 0.07;
  const blockH = 0.34;
  out.wood.push(slab(0.38, blockH + 0.1, 0.22, { bevel: 0.015, seed: seed + 8, wobble: 0.003, tone: 0.08, grime: 0.5 }).translate(cx, bY - 0.1, cz));
  const top = bY + blockH;
  const seg = lod === 0 ? 14 : lod === 1 ? 8 : 6;
  for (const s of [-1, 1]) {
    out.bronze.push(revolve(profileOf([[0.045, 0], [0.052, 0], [0.052, 0.03], [0.04, 0.03], [0.04, 0.0]]), { segments: seg, metres: 0.3 }).translate(cx + s * 0.1, top, cz));
  }
  // The rocking beam on a post between the cylinders, a plunger rod down into each; handles at its ends.
  const postH = 0.42;
  out.wood.push(slab(0.07, postH, 0.07, { bevel: 0.01, seed: seed + 9, wobble: 0.002, tone: 0.05, grime: 0 }).translate(cx, top, cz - 0.075));
  const py = top + postH - 0.03;
  const tilt = 0.12;
  const arm = 0.62;
  const a = [cx - arm * Math.cos(tilt), py + arm * Math.sin(tilt), cz - 0.02];
  const b = [cx + arm * Math.cos(tilt), py - arm * Math.sin(tilt), cz - 0.02];
  out.wood.push(beam(a, b, 0.055, seed + 10, lod));
  if (lod < 2) {
    for (const s of [-1, 1]) {
      const ry = py - s * 0.1 * Math.sin(tilt) * 1;
      out.iron.push(cyl(0.01, 0.01, ry - top - 0.01, 5, cx + s * 0.1, top + 0.01, cz - 0.02));
    }
    // The handles: cross-bars at the beam's ends, worn smooth.
    for (const p of [a, b]) out.wood.push(beam([p[0], p[1], p[2] - 0.17], [p[0], p[1], p[2] + 0.17], 0.035, seed + 11, lod));
    out.iron.push(cyl(0.012, 0.012, 0.12, 5, cx, py - 0.06, cz - 0.075));
  }
  // The delivery pipe up the block's front, a swivel and the nozzle aimed out over the forecourt.
  const pz = cz + 0.13;
  out.bronze.push(tube([[cx, bY + 0.15, cz + 0.1], [cx, bY + 0.2, pz], [cx, top + 0.45, pz], [cx + 0.03, top + 0.62, pz + 0.05], [cx + 0.12, top + 0.7, pz + 0.22]], 0.022, { radial: lod ? 5 : 8, segments: lod ? 6 : 14, around: 0.15 }));
  if (lod < 2) out.bronze.push(revolve(profileOf([[0.03, 0], [0.034, 0.02], [0.034, 0.06], [0.03, 0.08], [0, 0.08]]), { segments: seg, metres: 0.3 }).translate(cx, top + 0.42, pz));
}

/** Build the prefecture: { group, meshes, triangles }; meshes tagged in userData.when. */
export function buildPrefecture({ lod = 0, seed = 41 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = {
    trav: [], brick: [], tile: [], wood: [], dark: [], iron: [], bronze: [], marble: [], letters: [], red: [], plaster: [],
    doorOpen: [], doorShut: [], studsOpen: [], studsShut: [], bucketsHome: [], bailsHome: [], ladder: [], hook: [], hookIron: [],
    axeWood: [], axeIron: [], rope: [], centones: [], water: [], buckets: [], bails: [], flags: [],
  };
  const H = P.half - 0.02;
  // Limestone flags round the house to the tile's edge: the forecourt, the strip along the side wall,
  // the narrow ones behind and at the left (each laid on its own, so none is cut by the house).
  const flags = { rowW: 0.55, minL: 0.45, maxL: 0.9, lod };
  out.flags.push(...paving(-H, H, P.z1, H, P.floorY, seed + 3, flags));
  out.flags.push(...paving(P.x1, H, -H, P.z1, P.floorY, seed + 4, { ...flags, rowW: 0.85 / 2 }));
  out.flags.push(...paving(-H, P.x1, -H, P.z0, P.floorY, seed + 5, { ...flags, rowW: P.z0 + H }));
  out.flags.push(...paving(-H, P.x0, P.z0, P.z1, P.floorY, seed + 6, { ...flags, rowW: 0.6 }));
  house(lod, seed, out);
  kit(lod, seed + 200, out);
  pump(lod, seed + 300, out);
  // Two buckets filled at the pump, by the tank, while the crew is home.
  if (lod < 2) {
    for (const [x, z, r] of [[-0.6, 0.95, 0.3], [-0.52, 1.42, -0.6]]) {
      const h = hama(lod);
      out.buckets.push(h.body.clone().rotateY(r).translate(x, P.floorY, z));
      if (h.bail) out.bails.push(h.bail.clone().rotateY(r).translate(x, P.floorY, z));
    }
  }
  // Far out (a tile a few dozen pixels across) the iron and bronze fittings are under a pixel, and each
  // material is one more draw call for every prefecture in view: left out.
  if (lod === 2) out.iron = out.bronze = [];
  const mats = {
    trav: material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 }),
    brick: material('brick', { surface: 'brick', vertexColors: true, snow: 1 }),
    tile: material('roof-tile', { surface: 'terracotta', vertexColors: true, snow: 1 }),
    wood: material('wood', { surface: 'wood', vertexColors: true, snow: 1 }),
    iron: material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }),
    bronze: material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }),
    marble: material('marble', { surface: 'marble', vertexColors: true, snow: 1 }),
    stone: material('limestone', { surface: 'limestone', vertexColors: true, snow: 1 }),
    rope: material('rope', { surface: 'rope', vertexColors: true, snow: 0.6, normal: 1 }),
    // The buckets' rope sealed black with pitch: the rope's texture, darkened.
    pitch: material('pitched-rope', { surface: 'rope', color: 0x4a3b2e, vertexColors: true, snow: 0.6 }),
    wool: material('centones', { surface: 'wool', vertexColors: true, snow: 0.8 }),
    red: material('stucco-red', { surface: 'plaster', color: 0xc0644a, vertexColors: true, snow: 1 }),
    plaster: material('plaster', { surface: 'plaster', vertexColors: true, snow: 1 }),
    letters: material('inscription-red', { color: 0x6a1e14, roughness: 0.8, snow: 0.3 }),
    dark: material('room-dark', { color: 0x0e0b09, roughness: 1, snow: 0, wet: 0 }),
  };
  const p = new TaggedParts('prefecture');
  p.add('flags', mats.stone, out.flags);
  p.add('stone', mats.trav, out.trav);
  p.add('walls', mats.brick, out.brick);
  p.add('roof', mats.tile, out.tile);
  p.add('wood', mats.wood, out.wood);
  p.add('inside', mats.dark, out.dark, { cast: false });
  p.add('iron', mats.iron, out.iron);
  p.add('bronze', mats.bronze, out.bronze);
  p.add('plaque', mats.marble, out.marble);
  p.add('letters', mats.letters, out.letters, { cast: false });
  p.add('lararium', mats.red, out.red, { cast: false });
  p.add('aedicula', mats.plaster, out.plaster);
  p.add('rope', mats.rope, out.rope, { when: 'always' });
  p.add('doors', mats.wood, out.doorOpen, { when: 'staffed' });
  p.add('doors', mats.wood, out.doorShut, { when: 'shut' });
  p.add('studs', mats.iron, out.studsOpen, { when: 'staffed' });
  p.add('studs', mats.iron, out.studsShut, { when: 'shut' });
  // What the crew takes to a fire: the racked buckets, the ladder, the hook, the axes, the blankets.
  p.add('buckets', mats.pitch, out.bucketsHome, { when: 'home' });
  p.add('bails', mats.rope, out.bailsHome, { when: 'home' });
  p.add('ladder', mats.wood, out.ladder, { when: 'home' });
  p.add('hook', mats.wood, out.hook, { when: 'home' });
  p.add('hook-iron', mats.iron, out.hookIron, { when: 'home' });
  p.add('axes', mats.wood, out.axeWood, { when: 'home' });
  p.add('axe-heads', mats.iron, out.axeIron, { when: 'home' });
  p.add('centones', mats.wool, out.centones, { when: 'home' });
  p.add('buckets', mats.pitch, out.buckets, { when: 'open' });
  p.add('bails', mats.rope, out.bails, { when: 'open' });
  // The pump's water (the game swaps in ice in a hard frost: PUMP_WATER), see-through, casting no shadow.
  p.add(PUMP_WATER, waterMaterial(), out.water, { cast: false });
  // The lantern by the door: lit while staffed (the lab's night lights its panes), dark when shut.
  if (lod < 2) {
    const [lx, ly, lz] = P.lamp;
    const l = lantern(lx, ly, lz, lod);
    p.add('bronze', mats.bronze, [...l.bronze, tube([[lx, ly + 0.42, P.z1 + 0.01], [lx, ly + 0.42, lz - 0.1], [lx, ly + 0.36, lz]], 0.012, { radial: 4, segments: 4, around: 0.3 })]);
    p.add('lamp', lanternPane(), [l.pane], { when: 'staffed', cast: false });
    p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
  }
  // The vigiles: one at the door (staying while the others are out at a fire), one working the pump.
  if (lod === 0) {
    const guard = figureParts({ cloth: 0x7a3326, cloth2: 0x4a3a2c }, 0.24, P.floorY, P.z1 + 0.78, 0.25);
    for (const f of guard) p.add(`watchman-${f.material.name}`, f.material, [f.g], { when: 'staffed' });
    const pumpman = figureParts({ cloth: 0x7a3326, reach: 0.9 }, -0.28, P.floorY, P.tank[3] - 0.1, -Math.PI / 2 + 0.15);
    for (const f of pumpman) p.add(`pumpman-${f.material.name}`, f.material, [f.g], { when: 'open' });
  }
  return p.build();
}
