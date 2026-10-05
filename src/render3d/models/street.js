/**
 * models/street.js
 * ----------------------------------------------------------------------------
 * The street the well stands in, for the look lab: a 3 x 3 tile patch
 * (12 m square, centred on the origin) of a Pompeian street, and what it
 * takes to read the well's scale against.
 *
 *   - Basalt paving: the polygonal lava blocks of Pompeii's streets, a real
 *     displaced mesh (each stone's cushioned top and worn arris, the joints
 *     between them), ending in a row of low edge stones.
 *   - A raised pavement (0.3 m, as high as Pompeii's) of cocciopesto with
 *     white tesserae, behind a kerb of tufa blocks.
 *   - A plastered house front: red dado, a doorway with limestone jambs,
 *     a timber lintel, a threshold and a door ajar on a dark room; a small
 *     barred window; tiled eaves with antefixes; a torch on a bracket.
 *   - Beaten earth with grass where the paving ends; amphorae by the door.
 *
 * Metres, y up, the street's surface at y = 0 (as models/well.js).
 * Everything runs on past the patch (to EXTENT) and fades out there
 * (materials.js LOOK fade): a patch cut off square reads as a diorama.
 * ----------------------------------------------------------------------------
 */

import {
  Group, Mesh, InstancedMesh, BufferGeometry, BoxGeometry, Float32BufferAttribute, PlaneGeometry, CylinderGeometry, Matrix4,
  Quaternion, Vector3, Euler, Color, PointLight, BackSide, DoubleSide, MeshBasicMaterial, AdditiveBlending,
} from 'three';
import { block, revolve, profileOf, tube, merge, tintGeometry, boxUV, triangles } from '../shapes.js';
import { material, surfaceTextures } from '../materials.js';
import { artRng, fbm, smoothstep } from '../texgen.js';

/** Layout (metres): where the parts of the street lie. */
export const STREET = Object.freeze({
  half: 6, // the 3 x 3 tile patch
  extent: 12, // how far things run on before the fade has eaten them
  wallZ: -6, // the house front's face
  kerbZ: -4.55, // the kerb's back (the pavement runs from the wall to here)
  kerbW: 0.3,
  pavementY: 0.3,
  earthZ: 3.7, // where the paving ends and the earth begins
  edgeW: 0.32, // the row of edge stones between the paving and the earth
  door: [1.6, 2.9], // the doorway's x span
  doorH: 2.5,
  wallH: 4.25,
});

/**
 * The basalt paving: a grid displaced by the basalt surface's own low-pass
 * height. The stones' levels come with the basalt's textures (painted in the
 * background, materials.js): until then the grid lies level, and the same
 * grid is raised in place when they come, with the
 * stones' colour and joints, so nothing appears or moves but the stones.
 */
function paving() {
  const tex = surfaceTextures('basalt');
  const M = tex.metres;
  const x0 = -STREET.extent;
  const x1 = STREET.extent;
  const z0 = STREET.kerbZ + STREET.kerbW - 0.02;
  const z1 = STREET.earthZ;
  const step = 0.07;
  const nx = Math.ceil((x1 - x0) / step);
  const nz = Math.ceil((z1 - z0) / step);
  const pos = [];
  const uv = [];
  const col = [];
  const height = (x, z, low) => {
    const u = (((x / M) % 1) + 1) % 1;
    const v = (((z / M) % 1) + 1) % 1;
    return low ? (low.sample(u, v) - 0.8) * 0.08 : 0;
  };
  for (let j = 0; j <= nz; j++) {
    const z = z0 + ((z1 - z0) * j) / nz;
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      pos.push(x, height(x, z), z);
      uv.push(x, z);
      // The paving darkens toward the kerb's foot where dirt gathers.
      const t = 0.8 + 0.2 * smoothstep(z0, z0 + 0.5, z);
      col.push(t, t, t);
    }
  }
  const idx = [];
  const W = nx + 1;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * W + i;
      idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
    }
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // The stones' levels, when the basalt is painted (at once when it already is).
  const raise = (maps) => {
    if (!maps || !maps.height) return;
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i), maps.height));
    p.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
  };
  if (tex.maps) raise(tex.maps);
  else tex.whenReady.then(raise);
  return g;
}

/** A plain box with UVs in metres (offset so faces show different stone), bottom at y0. */
function slab(w, h, d, x, y0, z, { ou = 0, ov = 0 } = {}) {
  const g = block(w, h, d, { bevel: 0.004, wobble: 0, grime: 0, seed: 1, seg: 1 });
  g.translate(x, y0, z);
  boxUV(g, ou, ov);
  return g;
}

/** The pavement and its kerb of tufa blocks. */
function pavement(seed) {
  const rnd = artRng(seed);
  const E = STREET.extent;
  const top = STREET.pavementY;
  const z0 = STREET.wallZ;
  const z1 = STREET.kerbZ;
  const walk = slab(2 * E, top + 0.1, z1 - z0 + 0.02, 0, -0.1, (z0 + z1) / 2);
  const kerb = [];
  let x = -E;
  let n = 0;
  while (x < E) {
    const len = 0.7 + rnd() * 0.6;
    const g = block(Math.min(len, E - x) - 0.008, top + 0.17 + (rnd() - 0.5) * 0.01, STREET.kerbW, {
      bevel: 0.03 + rnd() * 0.015, seed: seed * 31 + ++n, wobble: 0.008, grime: 0.45, topSag: 0.015, tone: 0.12,
    });
    g.translate(x + len / 2, -0.16, STREET.kerbZ + STREET.kerbW / 2);
    kerb.push(g);
    x += len;
  }
  // The street's far edge: a row of low edge stones set in the earth, a
  // hand above the paving, so the street ends in a clean line rather than
  // the earth's bumps wandering over the stones.
  x = -E;
  while (x < E) {
    const len = 0.6 + rnd() * 0.5;
    const g = block(Math.min(len, E - x) - 0.008, 0.2 + (rnd() - 0.5) * 0.008, STREET.edgeW, {
      bevel: 0.025 + rnd() * 0.01, seed: seed * 37 + ++n, wobble: 0.006, grime: 0.5, topSag: 0.01, tone: 0.12,
    });
    g.translate(x + len / 2, -0.15, STREET.earthZ + STREET.edgeW / 2 - 0.02);
    kerb.push(g);
    x += len;
  }
  return { walk, kerb };
}

/** The earth past the edge stones: a gently uneven grid, starting just under the stones and staying below their tops. */
function earth() {
  const E = STREET.extent;
  const z0 = STREET.earthZ + STREET.edgeW - 0.06;
  const z1 = E;
  const g = new PlaneGeometry(2 * E, z1 - z0, 120, 40);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, (z0 + z1) / 2);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = fbm((x / 24 + 1) % 1, (z / 24 + 1) % 1, 6, 3, 41) - 0.5;
    const rise = smoothstep(STREET.earthZ - 0.1, STREET.earthZ + 1.5, z) * 0.05;
    pos.setY(i, -0.012 + rise + n * 0.06);
    uv.setXY(i, x, z);
  }
  g.computeVertexNormals();
  return tintGeometry(g, (x, y, z) => 0.85 + 0.15 * smoothstep(STREET.earthZ, STREET.earthZ + 0.6, z));
}

/** Grass: instanced blades in clumps on the earth, a few in the paving's edge and at the kerb's foot. */
function grass(seed, count = 9000) {
  // One blade: a tapering strip of three segments, 1 tall, curving forward (scaled per instance).
  const segs = 3;
  const pos = [];
  const idx = [];
  const col = [];
  for (let k = 0; k <= segs; k++) {
    const t = k / segs;
    const w = 0.02 * (1 - t * 0.85);
    const bend = t * t * 0.18;
    pos.push(-w, t, bend, w, t, bend);
    const c = 0.35 + 0.65 * t;
    col.push(c, c, c, c, c, c);
  }
  for (let k = 0; k < segs; k++) {
    const a = k * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // Blades are lit as if they faced up a little: grass reads lit from above, not as cards.
  const nrm = g.attributes.normal;
  for (let i = 0; i < nrm.count; i++) {
    const v = new Vector3(nrm.getX(i), nrm.getY(i) + 0.6, nrm.getZ(i)).normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
  }
  const mat = material('grass', { color: 0xffffff, roughness: 0.78, vertexColors: true, side: DoubleSide, sway: 0.05, swayH: 1, snow: 0.25, wet: 0 });
  const mesh = new InstancedMesh(g, mat, count);
  const rnd = artRng(seed);
  const m = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const s = new Vector3();
  const p = new Vector3();
  const greens = [new Color('#4b6620'), new Color('#5a7526'), new Color('#687c2c'), new Color('#7a7f34'), new Color('#8f8742')];
  const c = new Color();
  let n = 0;
  const E = STREET.extent;
  let tries = 0;
  while (n < count && tries < count * 20) {
    tries++;
    let x;
    let z;
    let y = 0;
    const r = rnd();
    if (r < 0.86) {
      // On the earth, in clumps: keep a blade where the clump noise says so.
      x = (rnd() * 2 - 1) * E;
      z = STREET.earthZ + STREET.edgeW + rnd() * (E - STREET.earthZ - STREET.edgeW); // (none through the edge stones)
      const clump = fbm((x / 20 + 1) % 1, (z / 20 + 1) % 1, 10, 3, 77);
      const nearEdge = 1 - smoothstep(STREET.earthZ, STREET.earthZ + 0.5, z);
      if (rnd() > smoothstep(0.42, 0.62, clump) + nearEdge * 0.5) continue;
      y = 0.0 + smoothstep(STREET.earthZ - 0.1, STREET.earthZ + 1.5, z) * 0.05 - 0.01;
    } else {
      // At the kerb's foot and against the wall.
      x = (rnd() * 2 - 1) * E;
      if (rnd() < 0.6) {
        z = STREET.kerbZ + STREET.kerbW + 0.02 + rnd() * 0.05;
        y = -0.02;
      } else {
        z = STREET.wallZ + 0.03 + rnd() * 0.05;
        y = STREET.pavementY - 0.005;
        if (x > STREET.door[0] - 0.3 && x < STREET.door[1] + 0.3) continue;
      }
      if (fbm((x / 20 + 1) % 1, 0.5, 12, 2, 78) < 0.52) continue;
    }
    const h = 0.08 + rnd() * rnd() * 0.32;
    p.set(x, y, z);
    e.set((rnd() - 0.5) * 0.5, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.5);
    q.setFromEuler(e);
    s.set(1 + rnd() * 0.6, h, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    c.copy(greens[Math.floor(rnd() * greens.length)]);
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'grass';
  return mesh;
}

/** The house front with its doorway, window, eaves and the dark room behind the door. */
function house(seed) {
  const rnd = artRng(seed);
  const E = STREET.extent;
  const z = STREET.wallZ;
  const T = 0.5;
  const y0 = STREET.pavementY;
  const H = STREET.wallH;
  const [d0, d1] = STREET.door;
  const dH = STREET.doorH;
  const jamb = 0.2;
  const wall = [];
  // Plaster: wall pieces either side of the doorway and over it, v measured from the pavement.
  const piece = (xa, xb, ya, yb) => {
    // No bevel: the pieces meet flush and their UVs are in world metres, so the wall shows no seam.
    const g = block(xb - xa, yb - ya, T, { bevel: 0.0005, seed: 3, wobble: 0, grime: 0, seg: 1 });
    g.translate((xa + xb) / 2, ya, z - T / 2);
    boxUV(g, 0, -y0);
    wall.push(g);
  };
  piece(-E, d0 - jamb, y0, y0 + H);
  piece(d1 + jamb, E, y0, y0 + H);
  piece(d0 - jamb, d1 + jamb, y0 + dH + 0.28, y0 + H);
  // Limestone jambs and threshold, a timber lintel.
  const stone = [];
  for (const [xa, xb] of [[d0 - jamb, d0], [d1, d1 + jamb]]) {
    const g = block(xb - xa, dH, T + 0.04, { bevel: 0.02, seed: 10 + xa, wobble: 0.004, grime: 0.4 });
    g.translate((xa + xb) / 2, y0, z - T / 2 + 0.02);
    stone.push(g);
  }
  const sill = block(d1 - d0 + 0.02, 0.07, T + 0.1, { bevel: 0.015, seed: 12, wobble: 0.003, grime: 0.2, topSag: 0.01 });
  sill.translate((d0 + d1) / 2, y0 - 0.04, z - T / 2 + 0.05);
  stone.push(sill);
  const wood = [];
  const lintel = block(0.26, d1 - d0 + 2 * jamb + 0.3, T + 0.06, { bevel: 0.02, seed: 13, wobble: 0.005, grime: 0 });
  lintel.translate(0, -(d1 - d0 + 2 * jamb + 0.3) / 2, 0);
  lintel.rotateZ(Math.PI / 2);
  lintel.translate((d0 + d1) / 2, y0 + dH + 0.13, z - T / 2 + 0.03);
  wood.push(lintel);
  // The door: two leaves of boards, the left one shut, the right ajar into the room.
  const leafW = (d1 - d0) / 2;
  const leaf = (open) => {
    const boards = [];
    const nb = 3;
    for (let k = 0; k < nb; k++) {
      const b = block(leafW / nb - 0.006, dH - 0.03, 0.05, { bevel: 0.008, seed: 20 + k + (open ? 5 : 0), wobble: 0.002, grime: 0.3 });
      b.translate(-leafW / 2 + (k + 0.5) * (leafW / nb), 0, 0);
      boards.push(b);
    }
    for (const yy of [0.35, dH - 0.5]) {
      const b = block(leafW - 0.02, 0.1, 0.03, { bevel: 0.008, seed: 30 + yy, wobble: 0.002, grime: 0 });
      b.translate(0, yy, 0.035);
      boards.push(b);
    }
    return merge(boards);
  };
  const shut = leaf(false);
  shut.translate(d0 + leafW / 2, y0 + 0.02, z - T + 0.1);
  wood.push(shut);
  const ajar = leaf(true);
  ajar.translate(-leafW / 2, 0, 0);
  ajar.rotateY(-1.1);
  ajar.translate(d1, y0 + 0.02, z - T + 0.1);
  wood.push(ajar);
  // The dark room behind (seen through the door): a box seen from inside.
  const room = new CylinderGeometry(1, 1, 1, 4, 1, false);
  room.rotateY(Math.PI / 4);
  room.scale((d1 - d0 + 1.2) / Math.SQRT2, 2.8, 1.6 / Math.SQRT2);
  room.translate((d0 + d1) / 2, y0 + 1.4, z - T - 0.8);
  // A small barred window high up, left of the door.
  const iron = [];
  const wx = -2.6;
  const wy = y0 + 2.75;
  const recess = block(0.62, 0.48, 0.12, { bevel: 0.01, seed: 40, wobble: 0, grime: 0, seg: 1 });
  recess.translate(wx, wy, z + 0.001 - 0.06);
  for (let k = 0; k < 4; k++) {
    const bar = block(0.018, 0.48, 0.018, { bevel: 0.004, seed: 41 + k, wobble: 0.001, grime: 0, seg: 1 });
    bar.translate(wx - 0.21 + k * 0.14, wy, z + 0.005);
    iron.push(bar);
  }
  // Eaves: a beam end every 0.6 m, then tegulae and imbrices sloping back, antefixes at the eave.
  const tiles = [];
  const eaveY = y0 + H;
  const slope = 0.32;
  const over = 0.45;
  for (let x = -E; x < E; x += 0.6) {
    const b = block(0.12, 0.14, over + 0.3, { bevel: 0.015, seed: 50 + x, wobble: 0.004, grime: 0 });
    b.translate(x + 0.3, eaveY - 0.14, z + over / 2 - 0.15);
    wood.push(b);
  }
  const tegW = 0.5;
  const tegL = 0.62;
  const lap = 0.08; // each row of tegulae laps over the one below it
  const ROWS = 6; // the roof runs 3 m back from the eave: it hides the room behind the door
  // Tiles are laid out in the roof's own plane (x along the wall, -z up the slope, y off the
  // roof), then the plane is tilted up toward the back and set on the eave.
  const toRoof = (g) => {
    g.rotateX(slope);
    g.translate(0, eaveY + 0.02, z + over);
    return g;
  };
  const imL = ROWS * (tegL - lap) + lap;
  for (let x = -E; x < E; x += tegW) {
    for (let row = 0; row < ROWS; row++) {
      const t = block(tegW - 0.03, 0.025, tegL, { bevel: 0.006, seed: 60 + x * 7 + row, wobble: 0.004, grime: 0, seg: 1, tone: 0.08 });
      // Each tile tipped a little more than the roof, its lower end resting on the row below.
      t.translate(0, 0, -tegL / 2);
      t.rotateX(0.04);
      t.translate(x + tegW / 2, 0, -row * (tegL - lap));
      tiles.push(toRoof(t));
    }
    // The imbrex over the joint: a half pipe up the slope. Its -z half, turned to lie along -z,
    // is the half facing up (a ridge, not a gutter).
    const im = new CylinderGeometry(0.075, 0.08, imL, 10, 1, true, Math.PI / 2, Math.PI);
    im.rotateX(Math.PI / 2);
    im.translate(x + tegW, 0.02, -imL / 2 + 0.02);
    toRoof(im);
    boxUV(im);
    tiles.push(tintGeometry(im));
    // Antefix: a small upright palmette plate closing the imbrex at the eave.
    const af = revolve(profileOf([[0, 0], [0.07, 0], [0.085, 0.06], [0.06, 0.13], [0.02, 0.17], [0, 0.18]]), { segments: 6, metres: 0.6 });
    af.scale(1, 1, 0.12);
    af.translate(x + tegW, eaveY + 0.0, z + over + 0.03);
    tiles.push(af);
  }
  // The house behind its front: a mass under the roof, its top following the slope, so the
  // view turned to the back or the side shows a building, not a stage flat. It leaves the room
  // behind the door hollow.
  const back = z + over - imL * Math.cos(slope) + 0.12; // tucked under the roof's last row
  const rise = Math.tan(slope);
  const mass = (xa, xb, za, zb, ya) => {
    const g = new BoxGeometry(xb - xa, 1, za - zb, 1, 1, 1);
    g.translate((xa + xb) / 2, 0.5, (za + zb) / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const top = pos.getY(i) > 0.5;
      // The top follows the roof's underside, a hand below the tiles.
      const yTop = eaveY - 0.05 + (z + over - pos.getZ(i)) * rise - over * rise;
      pos.setY(i, top ? yTop : ya);
    }
    g.computeVertexNormals();
    boxUV(g, 0, -y0);
    wall.push(tintGeometry(g));
  };
  const [r0, r1] = [d0 - 0.6, d1 + 0.6];
  const roomBack = z - T - 1.6;
  mass(-E, r0, z - T, back, y0);
  mass(r1, E, z - T, back, y0);
  mass(r0, r1, roomBack, back, y0);
  mass(r0, r1, z - T, roomBack, y0 + 2.8);
  return { wall, stone, wood, iron, tiles, room: tintGeometry(room), recess: tintGeometry(recess) };
}

/** A torch on an iron bracket by the door: the stick, the pitch-soaked head, the flame, its light. */
function torch() {
  const x = STREET.door[0] - 0.55;
  const y = STREET.pavementY + 2.05;
  const z = STREET.wallZ + 0.02;
  const iron = [];
  const plate = block(0.08, 0.2, 0.015, { bevel: 0.004, seed: 80, wobble: 0, grime: 0 });
  plate.translate(x, y - 0.1, z);
  iron.push(plate);
  const arm = block(0.02, 0.2, 0.02, { bevel: 0.004, seed: 81, wobble: 0, grime: 0 });
  arm.translate(0, -0.1, 0);
  arm.rotateX(Math.PI / 2);
  arm.translate(x, y, z + 0.1);
  iron.push(arm);
  const ring = new CylinderGeometry(0.03, 0.03, 0.03, 14, 1, true);
  ring.translate(x, y, z + 0.2);
  iron.push(tintGeometry(ring));
  const tilt = 0.32;
  const stick = new CylinderGeometry(0.018, 0.022, 0.55, 8);
  stick.translate(0, 0.0, 0);
  stick.rotateX(tilt);
  stick.translate(x, y + 0.03, z + 0.2 + 0.0);
  const head = new CylinderGeometry(0.04, 0.03, 0.14, 10);
  head.rotateX(tilt);
  const hy = y + 0.03 + Math.cos(tilt) * 0.3;
  const hz = z + 0.2 + Math.sin(tilt) * 0.3;
  head.translate(x, hy, hz);
  // The flame: a soft teardrop, drawn additive (bloom catches it).
  const flame = revolve(profileOf([[0, 0], [0.04, 0.03], [0.05, 0.08], [0.035, 0.16], [0.012, 0.25], [0, 0.29]]), { segments: 12, metres: 1 });
  const flameMat = new MeshBasicMaterial({ color: new Color(6, 3.1, 1.1), transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  const fm = new Mesh(flame, flameMat);
  fm.position.set(x, hy + 0.05, hz + 0.02);
  fm.name = 'torch-flame';
  const light = new PointLight(0xff9b4a, 0, 10, 2);
  light.position.set(x, hy + 0.15, hz + 0.08);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.002;
  light.shadow.normalBias = 0.03;
  light.shadow.radius = 5;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 10;
  light.name = 'torch-light';
  return { iron, wood: [tintGeometry(stick)], head: tintGeometry(head), flame: fm, light };
}

/** An amphora (Dressel 2-4 style, the common wine jar of Campania): spike foot, long body, double-rod handles. */
function amphora() {
  const P = profileOf([
    [0.0, 0.0], [0.025, 0.0], [0.03, 0.04], [0.03, 0.1], [0.07, 0.2], [0.13, 0.35], [0.15, 0.5], [0.145, 0.62],
    [0.12, 0.72], [0.08, 0.77], [0.055, 0.8], [0.05, 0.95], [0.058, 0.97], [0.06, 0.99], [0.045, 1.0], [0.04, 0.98], [0.0, 0.97],
  ]);
  const body = revolve(P, { segments: 28, metres: 0.6, tint: (p) => 0.75 + 0.25 * smoothstep(0.0, 0.3, p.y) });
  const parts = [body];
  for (const s of [-1, 1]) {
    const h = tube([[s * 0.055, 0.92, 0], [s * 0.1, 0.94, 0], [s * 0.11, 0.86, 0], [s * 0.12, 0.74, 0]], 0.013, { radial: 6, around: 0.6 });
    parts.push(h);
  }
  return merge(parts);
}

/** The street patch as a Group, with its lights. */
export function buildStreet({ seed = 11, grassCount = 9000 } = {}) {
  const group = new Group();
  group.name = 'street';
  const meshes = [];
  const add = (geo, mat, name, cast = true) => {
    const m = new Mesh(geo, mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
    meshes.push(m);
    return m;
  };
  add(paving(), material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 }), 'paving', false);
  const pv = pavement(seed);
  add(merge([pv.walk]), material('cocciopesto', { surface: 'cocciopesto', vertexColors: true, snow: 0.9 }), 'pavement');
  add(merge(pv.kerb), material('tufa', { surface: 'tufa', vertexColors: true, snow: 1 }), 'kerb');
  add(earth(), material('earth', { surface: 'earth', vertexColors: true, snow: 1 }), 'earth', false);
  const hs = house(seed + 1);
  add(merge(hs.wall), material('plaster', { surface: 'plaster', vertexColors: true, snow: 1 }), 'wall');
  add(merge(hs.stone), material('limestone', { surface: 'limestone', vertexColors: true, snow: 1 }), 'door-stone');
  const tr = torch();
  add(merge([...hs.wood, ...tr.wood]), material('wood', { surface: 'wood', vertexColors: true, snow: 1 }), 'house-wood');
  add(merge([...hs.iron, ...tr.iron]), material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }), 'house-iron');
  add(merge(hs.tiles), material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 1 }), 'tiles');
  add(hs.room, material('room-dark', { color: 0x0e0b09, roughness: 1, side: BackSide, snow: 0, wet: 0 }), 'room', false);
  add(hs.recess, material('recess-dark', { color: 0x0b0908, roughness: 1, snow: 0, wet: 0 }), 'window', false);
  add(tr.head, material('pitch', { color: 0x1c1410, roughness: 0.7, snow: 0 }), 'torch-head');
  group.add(tr.flame);
  group.add(tr.light);
  // Two amphorae by the door: one leaning on the wall, one lying.
  const amph = amphora();
  const a1 = amph.clone();
  a1.rotateX(-0.12);
  a1.translate(STREET.door[1] + 0.55, STREET.pavementY, STREET.wallZ + 0.22);
  const a2 = amph.clone();
  a2.rotateZ(Math.PI / 2 - 0.08);
  a2.rotateY(0.5);
  a2.translate(STREET.door[1] + 1.25, STREET.pavementY + 0.15, STREET.wallZ + 0.5);
  add(merge([a1, a2]), material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 1 }), 'amphorae');
  const gr = grass(seed + 2, grassCount);
  group.add(gr);
  meshes.push(gr);
  let tris = 0;
  for (const m of meshes) tris += triangles(m.geometry) * (m.isInstancedMesh ? m.count : 1);
  return { group, meshes, flame: tr.flame, torch: tr.light, triangles: tris };
}
