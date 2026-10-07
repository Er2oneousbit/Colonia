/**
 * models/turris.js
 * ----------------------------------------------------------------------------
 * The watchtower (Turris, 2 x 2 tiles) of the 3D look, from the towers Rome
 * set along its frontiers and town walls rather than from the 2D sprite:
 *
 *   - Hadrian's Wall's turrets: stone towers about 6 m square, two
 *     storeys, a door at the foot; the towers of the German and Danube
 *     limes, first of timber, then of stone.
 *   - Trajan's Column's watchtowers along the Danube (its opening scenes):
 *     a square tower of stone, a timber gallery running round the upper
 *     storey on beams, a tiled roof, a torch thrust out of an upper window
 *     for signalling, and beside the tower stacks of logs and ricks of hay
 *     ready for the signal fires; a palisade round some.
 *
 * So, on its 8 m square: a stone tower 6 m square of the province's stone
 * (models/townWall.js WALL_LOOKS) on a footing, dressed quoins; a door of
 * studded boards at its foot (open while it is manned); at 4.6 m a gallery
 * of planks on beams round all four sides with a railing, reached by a
 * ladder; an upper storey with arched windows; a hipped roof of tiles; a
 * torch in an iron bracket out of the front and the back window (the
 * night's light map lights the one the view sees); a log crib for the
 * beacon and a hay rick on the ground at two corners. Manned (staffed:
 * the sim's archers shoot from it, sim/military.js), two auxiliary archers
 * in green with conical helmets and bows keep watch on the gallery.
 *
 * Its walls stand 1 m in from the footprint's edge; a town wall that joins
 * it is carried into its face by a stub (walls/wallLayout.js). The tower
 * is as wide as a wall's two faces on a tile's line (2 m out from its
 * middle, 0.95 m either side), so the stub always meets stone.
 *
 * States (meshes tagged in userData.when, models.js partShows): 'open'
 * manned (the door open, the archers on watch), 'shut' (the door shut,
 * nobody). Metres, the footprint's middle at the origin, the front (the
 * door) toward +z, as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, Shape, ExtrudeGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { artRng, smoothstep } from '../texgen.js';
import { tiledRoof, TaggedParts } from './masonry.js';
import { doorLeaf, ladder, woodpile, strawStack, ruralMaterials, blk } from './rural.js';
import { figureParts } from './figure.js';
import { wallMaterials } from './townWall.js';
import { material } from '../materials.js';

/** The watchtower's measures (metres): the tests, the lab and the game read them. */
export const TURRIS = Object.freeze({
  half: 4,
  body: 3.0, // the tower's half width
  gallery: 4.6, // the gallery's floor
  out: 0.62, // how far the gallery stands out
  eave: 7.3,
  roof: 2.1,
  door: Object.freeze({ w: 1.1, h: 2.0 }),
  /** The torches out of the upper windows, front and back (x, y, z): the night lights the one in view (models.js modelLamps). */
  torch: Object.freeze([0, 6.25, 3.42]),
});
const T = TURRIS;

const grime = (y) => 0.8 + 0.2 * smoothstep(0, 1.6, y);

/** A box from (x0, y0, z0) to (x1, y1, z1), its foot's grime fading up it. */
function box(x0, x1, y0, y1, z0, z1, k = 1) {
  const g = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  boxUV(g);
  return tintGeometry(g, (x, y) => k * grime(y));
}

/** An arched recess (a window or a doorway's dark), w wide, h to its springing, on the face z = at (facing +z). */
function arched(w, h, y0, at, lod, depth = 0.03) {
  const s = new Shape();
  const seg = lod === 0 ? 8 : 4;
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  for (let k = 1; k <= seg; k++) {
    const t = (k / seg) * Math.PI;
    s.lineTo(Math.cos(t) * (w / 2), h + Math.sin(t) * (w / 2));
  }
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: seg });
  g.deleteAttribute('uv');
  g.translate(0, y0, at - depth + 0.012);
  g.computeVertexNormals();
  boxUV(g);
  return tintGeometry(g);
}

/** A ring of dressed stones round an arch's head (lod 0 and 1). */
function voussoirs(w, h, y0, z, lod) {
  const out = [];
  const n = lod === 0 ? 9 : 5;
  for (let k = 0; k < n; k++) {
    const t0 = (k / n) * Math.PI;
    const t1 = ((k + 1) / n) * Math.PI;
    const tm = (t0 + t1) / 2;
    const g = new BoxGeometry((w / 2 + 0.06) * (t1 - t0) * 0.94, 0.16, 0.06);
    g.rotateZ(tm + Math.PI / 2);
    g.translate(Math.cos(tm) * (w / 2 + 0.08), y0 + h + Math.sin(tm) * (w / 2 + 0.08), z);
    out.push(tintGeometry(boxUV(g)));
  }
  return out;
}

/** The faces' turns: each thing made on the front (+z) is turned onto the other three. */
const FACES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

/**
 * The watchtower in the province's stone (`look`: models/townWall.js
 * WALL_LOOKS). Returns { group, meshes, triangles }.
 */
export function buildTurris({ look = 'polygonal', lod = 0 } = {}) {
  const M = wallMaterials(look);
  const R = ruralMaterials();
  const P = new TaggedParts(`turris:${look}`);
  const h = T.body;
  const rnd = artRng(77);
  // The footing and the tower.
  P.add('foot', M.foot, box(-h - 0.14, h + 0.14, 0, 0.55, -h - 0.14, h + 0.14, 0.92));
  P.add('upper', M.upper, box(-h, h, 0.55, T.eave, -h, h));
  const dressed = [];
  const dark = [];
  const wood = [];
  const iron = [];
  // Quoins up the corners, string courses at the gallery and under the eaves.
  if (lod < 2) {
    dressed.push(box(-h - 0.07, h + 0.07, T.gallery - 0.28, T.gallery - 0.08, -h - 0.07, h + 0.07));
    dressed.push(box(-h - 0.12, h + 0.12, T.eave - 0.22, T.eave, -h - 0.12, h + 0.12));
    if (lod === 0) {
      for (let y = 0.55, k = 0; y < T.eave - 0.5; y += 0.52, k++) {
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const ax = k % 2 ? 0.62 : 0.36;
          const az = k % 2 ? 0.36 : 0.62;
          dressed.push(box(sx < 0 ? -h - 0.015 : h - ax, sx < 0 ? -h + ax : h + 0.015, y, y + 0.5, sz < 0 ? -h - 0.015 : h - az, sz < 0 ? -h + az : h + 0.015));
        }
      }
    }
  }
  // The door at the foot of the front: its dark opening, an arch of voussoirs, a threshold.
  const D = T.door;
  dark.push(arched(D.w, D.h, 0.55, h + 0.005, lod, 0.05));
  if (lod < 2) {
    dressed.push(...voussoirs(D.w, D.h, 0.55, h + 0.03, lod));
    dressed.push(box(-D.w / 2 - 0.18, D.w / 2 + 0.18, 0.5, 0.58, h - 0.05, h + 0.32));
  }
  for (const st of ['open', 'shut']) {
    const leaf = doorLeaf(D.w - 0.04, D.h + 0.15, 9, lod);
    if (st === 'open') {
      // Swung in against the jamb: its edge shows in the doorway.
      leaf.translate(D.w / 2 - 0.02, 0, 0).rotateY(-1.35).translate(-D.w / 2, 0.56, h - 0.08);
    } else {
      leaf.translate(0, 0.56, h - 0.06);
    }
    P.add('door', M.wood, leaf, { when: st });
  }
  // Slits in the lower storey and two arched windows each face above the gallery.
  for (const ry of FACES) {
    const slit = box(-0.09, 0.09, 2.4, 3.5, h - 0.02, h + 0.012);
    if (ry !== 0) dark.push(slit.rotateY(ry));
    for (const x of [-1.05, 1.05]) {
      const g = arched(0.6, 0.85, 5.15, h + 0.005, lod).translate(x, 0, 0).rotateY(ry);
      dark.push(g);
      if (lod < 2) for (const v of voussoirs(0.6, 0.85, 5.15, h + 0.03, lod)) dressed.push(v.translate(x, 0, 0).rotateY(ry));
      if (lod < 2) dressed.push(box(x - 0.42, x + 0.42, 5.07, 5.15, h - 0.02, h + 0.1).rotateY(ry));
    }
  }
  // The gallery: planks on beams standing out of the walls, a railing round it.
  const g0 = T.gallery;
  const o = h + T.out;
  for (const ry of FACES) {
    const floor = blk(lod, 2 * o, 0.08, T.out, { bevel: 0.01, seed: 3, grime: 0.2, seg: 1 });
    floor.translate(0, g0, h + T.out / 2);
    wood.push(floor.rotateY(ry));
    if (lod < 2) {
      // Beam ends under the planks, and the braces under every other.
      for (let x = -h + 0.3; x <= h - 0.3 + 1e-6; x += (2 * h - 0.6) / 6) {
        const b = blk(lod, 0.16, 0.18, T.out + 0.25, { bevel: 0.012, seed: 5 + x, grime: 0.2, seg: 1 });
        b.translate(x, g0 - 0.18, h + (T.out + 0.25) / 2 - 0.25);
        wood.push(b.rotateY(ry));
      }
      // Posts and two rails.
      const n = lod === 0 ? 7 : 4;
      for (let k = 0; k <= n; k++) {
        const x = -o + 0.06 + ((2 * o - 0.12) * k) / n;
        const p = blk(lod, 0.08, 1.02, 0.08, { bevel: 0.008, seed: 7 + k, grime: 0.15, seg: 1 });
        p.translate(x, g0 + 0.08, o - 0.06);
        wood.push(p.rotateY(ry));
      }
      for (const y of [0.55, 1.05]) {
        const r = blk(lod, 2 * o, 0.07, 0.06, { bevel: 0.006, seed: 11 + y, grime: 0, seg: 1 });
        r.translate(0, g0 + y, o - 0.06);
        wood.push(r.rotateY(ry));
      }
    } else {
      const r = new BoxGeometry(2 * o, 0.9, 0.05);
      r.translate(0, g0 + 0.55, o - 0.05);
      wood.push(tintGeometry(boxUV(r), () => 0.85).rotateY(ry));
    }
  }
  // A ladder up to the gallery beside the door.
  wood.push(ladder(g0 + 0.95, 0.07, 13, lod).translate(-1.95, 0, h + T.out + 0.28));
  // Torches out of the front and back windows, in iron brackets.
  if (lod < 2) {
    for (const ry of [0, Math.PI]) {
      const [tx, ty, tz] = T.torch;
      const arm = new BoxGeometry(0.05, 0.05, 0.5);
      arm.translate(tx, ty - 0.08, h + 0.22);
      iron.push(tintGeometry(boxUV(arm)).rotateY(ry));
      const ring = new CylinderGeometry(0.07, 0.06, 0.1, 8, 1, true);
      ring.translate(tx, ty, tz);
      iron.push(tintGeometry(boxUV(ring)).rotateY(ry));
      const stick = new CylinderGeometry(0.045, 0.035, 0.62, 6, 1);
      stick.rotateX(0.3);
      stick.translate(tx, ty + 0.16, tz + 0.06);
      wood.push(tintGeometry(boxUV(stick), (x, y) => (y > ty + 0.38 ? 0.2 : 0.75)).rotateY(ry));
    }
  }
  // The beacon's crib of logs at the front corner, a hay rick at the left one (Trajan's Column).
  const crib = [];
  const nl = lod === 2 ? 2 : 5;
  for (let l = 0; l < nl; l++) {
    for (const s of [-1, 1]) {
      const log = new CylinderGeometry(0.075, 0.075, 0.95, lod ? 5 : 8, 1);
      if (l % 2) log.rotateX(Math.PI / 2).translate(s * 0.36, 0.08 + l * 0.15, 0);
      else log.rotateZ(Math.PI / 2).translate(0, 0.08 + l * 0.15, s * 0.36);
      boxUV(log);
      crib.push(tintGeometry(log, () => 0.85 + rnd() * 0.2));
    }
  }
  if (lod < 2) {
    // Kindling heaped inside the crib.
    crib.push(...woodpile(0.7, 0.55, 21, lod).map((q) => q.translate(0, 0.05, 0)));
  }
  for (const q of crib) q.translate(3.38, 0, 3.38);
  P.add('bark', R.bark, crib);
  const rick = strawStack(0.48, 1.25, 23, lod);
  P.add('thatch', R.thatch, rick.thatch.map((q) => q.translate(-3.4, 0, 3.4)));
  wood.push(...rick.wood.map((q) => q.translate(-3.4, 0, 3.4)));
  P.add('dressed', M.dressed, dressed);
  P.add('dark', M.dark, dark, { cast: false });
  P.add('wood', M.wood, wood);
  if (iron.length) P.add('iron', M.iron, iron);
  // The hipped roof over the gallery's inner half.
  const eave = T.eave - 0.05;
  const ro = h + 0.42;
  const apex = [0, eave + T.roof, 0];
  const tiles = [];
  for (const q of [[[-ro, eave, ro], [ro, eave, ro]], [[ro, eave, ro], [ro, eave, -ro]], [[ro, eave, -ro], [-ro, eave, -ro]], [[-ro, eave, -ro], [-ro, eave, ro]]]) {
    tiles.push(...tiledRoof([q[0], q[1], apex, apex], { lod, seed: 31 + q[0][0] + 3 * q[0][2], pitch: 0.38, antefix: lod === 0 }).tiles);
  }
  if (lod < 2) {
    for (const [x, z] of [[-ro, ro], [ro, ro], [ro, -ro], [-ro, -ro]]) tiles.push(ridge([x, eave, z], apex, lod));
    // A bronze finial at the apex.
    const fin = new ConeGeometry(0.09, 0.38, 8, 1);
    fin.translate(0, eave + T.roof + 0.16, 0);
    P.add('finial', material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.5 }), tintGeometry(boxUV(fin)));
  }
  P.add('roof', M.tile, tiles);
  // Manned: two archers on the gallery, the front one and one on the right-hand side (close up only:
  // at the middle zooms a man is a few pixels and his figure thousands of triangles).
  if (lod === 0) {
    // (Each body's parts by its material's name, as figureParts gives them, and the bows and helmets.)
    const crew = { bows: [], helms: [] };
    const mats = {};
    const archer = (x, z, ry) => {
      for (const { g, material: m } of figureParts({ cloth: 0x4f7a3e, reach: 0.65, skin: 0xa07052, hair: 0x2a1d14 }, x, g0 + 0.08, z, ry)) {
        mats[m.name] = m;
        (crew[m.name] ??= []).push(g);
      }
      // His bow: an arc of horn and wood in the raised hand; his conical helmet (the Syrian archers of Trajan's Column).
      const bow = new TorusGeometry(0.62, 0.016, 5, lod === 0 ? 16 : 8, 1.7);
      bow.rotateZ(Math.PI / 2 - 0.85);
      bow.rotateY(Math.PI / 2);
      bow.translate(0.24, g0 + 0.08 + 1.36, 0.46 - 0.62 * Math.cos(0.85) + 0.05);
      bow.rotateY(ry).translate(x, 0, z);
      crew.bows.push(tintGeometry(boxUV(bow), () => 0.6));
      const helm = new ConeGeometry(0.115, 0.24, lod === 0 ? 10 : 6, 1);
      helm.translate(0, g0 + 0.08 + 1.76, 0.0);
      helm.rotateY(ry).translate(x, 0, z);
      crew.helms.push(tintGeometry(boxUV(helm)));
    };
    archer(-0.9, o - 0.38, 0);
    archer(o - 0.38, 0.7, Math.PI / 2);
    for (const [name, list] of Object.entries(crew)) {
      if (!list.length) continue;
      const m = name === 'bows' ? M.wood : name === 'helms' ? M.iron : mats[name];
      if (m) P.add(`crew-${name}`, m, list, { when: 'open' });
    }
  }
  return P.build();
}

/** Ridge tiles down a hip, from a to b. */
function ridge(a, b, lod) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const l = Math.hypot(dx, dy, dz);
  const g = new CylinderGeometry(0.09, 0.09, l, lod ? 6 : 10, 1, true, 0, Math.PI);
  g.rotateX(Math.PI / 2);
  g.rotateZ(Math.PI / 2);
  g.rotateX(-Math.asin(dy / l));
  g.rotateY(Math.atan2(dx, dz));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.045, (a[2] + b[2]) / 2);
  boxUV(g);
  return tintGeometry(g, () => 0.92);
}
