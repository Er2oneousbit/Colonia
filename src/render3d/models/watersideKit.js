/**
 * models/watersideKit.js
 * ----------------------------------------------------------------------------
 * What the three waterside works share (tradeDock.js, fishYard.js,
 * fishWharf.js): their materials, a net hung on a frame, the gable wall of
 * a plastered shed, the lanterns on their posts. The harbour vocabulary
 * itself (piles, moles, jetties, ashlar, bollards) is harbour.js's.
 *
 * Sources for the shapes (see each building's file for its own):
 *   - the waterfronts of the Roman and Greek harbours of the western
 *     Mediterranean, as the digs at Ostia, Cosa, Pompeii's Sarno port and
 *     Marseille's Vieux-Port show them: ashlar quays, timber jetties on
 *     driven piles, plastered sheds with tiled roofs, bollards and rings;
 *   - fishermen's gear from the mosaics of Sousse and Althiburos and the
 *     reliefs of Ostia: nets hung to dry from a pole, cork floats along
 *     the head rope and lead weights along the foot, baskets of the catch.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry } from 'three';
import { boxUV, tintGeometry, tube } from '../shapes.js';
import { material } from '../materials.js';
import { lantern, lanternPane } from './masonry.js';
import { harbourMaterials, board } from './harbour.js';

/** The materials of the three: the harbour's, a net's rope, the awning cloth, the boats' blue paint, tar. */
export function waterMaterials() {
  return {
    ...harbourMaterials(),
    // The nets: hemp and linen twine, tan (a net on its frame is lines, not a sheet; the sacking's look).
    net: material('sacking', { surface: 'wool', vertexColors: true, color: 0xc2a477, snow: 0.8 }),
    // A customs standard and the like: coloured linen.
    cloth: material('awning-linen', { surface: 'wool', color: 0xe8dcc4, vertexColors: true, snow: 1 }),
    // The blue band of a fishing boat (the fishing boat afloat is painted so: ships/designs.js).
    blue: material('boat-paint-blue', { color: 0x3f6f8f, roughness: 0.55, snow: 1 }),
    tar: material('pitch', { color: 0x1c1410, roughness: 0.7, snow: 0 }),
    wicker: material('wicker', { surface: 'wicker', vertexColors: true, snow: 0.8 }),
    lampOut: material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }),
  };
}

/** The lists a model gathers its geometry in, by name. */
export function bins(...names) {
  return Object.fromEntries(names.map((n) => [n, []]));
}

/**
 * The gable end of a shed whose ridge runs along x, as a wall: a box of
 * `thick` through x and `span` along z, whose top is the roof's triangle
 * (`rise` high at the middle, none at the ends), its foot at `eaveY`.
 * Centred on (x, z).
 */
export function gableWall(x, z, span, thick, eaveY, rise) {
  const g = new BoxGeometry(thick, rise, span, 1, 1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const top = p.getY(i) > 0;
    p.setY(i, top ? rise * (1 - Math.abs(p.getZ(i)) / (span / 2)) : 0);
  }
  g.computeVertexNormals();
  return tintGeometry(boxUV(g.translate(x, eaveY, z)));
}

/**
 * A net hung from a pole between `x0` and `x1` along x at (z, y), as a
 * lattice of twine: `drop` metres of it hanging, a mesh of about `mesh`
 * metres, cork floats along the head rope. In rope geometries, floats
 * apart (they take the wood's material). Returns { twine, floats }.
 */
export function hangingNet(x0, x1, z, y, drop, { mesh = 0.2, lod = 0, sag = 0.06 } = {}) {
  const twine = [];
  const floats = [];
  const w = x1 - x0;
  if (lod === 2) {
    // From far a net is one thin hanging sheet of twine.
    twine.push(tintGeometry(boxUV(new BoxGeometry(w, drop, 0.02).translate((x0 + x1) / 2, y - drop / 2, z)), () => 1.1));
    return { twine, floats };
  }
  const m = lod === 1 ? mesh * 1.7 : mesh;
  const nx = Math.max(2, Math.round(w / m));
  const ny = Math.max(2, Math.round(drop / m));
  // The uprights (each a line, a little off the true: a net sags and gathers along its foot).
  for (let i = 0; i <= nx; i++) {
    const x = x0 + (w * i) / nx;
    const hang = sag * Math.sin((i / nx) * Math.PI);
    twine.push(tintGeometry(boxUV(new BoxGeometry(0.028, drop - hang, 0.028).translate(x, y - (drop - hang) / 2, z)), () => 1.0 + 0.2 * Math.sin(i * 1.7)));
  }
  // The courses across.
  for (let j = 1; j <= ny; j++) {
    const yy = y - (drop * j) / ny;
    twine.push(tintGeometry(boxUV(new BoxGeometry(w, 0.024, 0.024).translate((x0 + x1) / 2, yy, z)), () => 1.1));
  }
  // Cork floats on the head rope, lead sinkers (dark twine knots) along the foot.
  const nf = lod ? 3 : Math.max(3, Math.round(w / 0.5));
  for (let k = 0; k < nf; k++) {
    const x = x0 + (w * (k + 0.5)) / nf;
    floats.push(tintGeometry(boxUV(new BoxGeometry(0.1, 0.05, 0.05).translate(x, y - 0.03, z)), () => 0.95));
  }
  return { twine, floats };
}

/**
 * Lanterns on posts, added to a TaggedParts `p`: each lamp
 * [x, y, z, foot] is a lantern whose base is at y, on a post from `foot`;
 * lit while the building is staffed ('open'), cold otherwise ('shut').
 * Returns nothing; the closer lods have none.
 */
export function addLanterns(p, m, lamps, lod) {
  if (lod >= 2) return;
  const wood = [];
  const bronze = [];
  const panes = [];
  for (const [x, y, z, foot] of lamps) {
    const l = lantern(x, y, z, lod);
    bronze.push(...l.bronze);
    panes.push(l.pane);
    wood.push(board(0.12, y - foot + 0.02, 0.12, { tone: 1.05 }).translate(x, foot, z));
    // A bracket arm under the lantern, a bronze hook above it.
    wood.push(board(0.3, 0.06, 0.06, { tone: 1.00 }).translate(x, y - 0.06, z));
    bronze.push(tube([[x, y + 0.3, z], [x, y + 0.4, z]], 0.012, { radial: 4, segments: 2, around: 0.3 }));
  }
  p.add('timber', m.wood, wood);
  p.add('lantern', m.bronze, bronze);
  p.add('lamp', lanternPane(), panes, { when: 'open', cast: false });
  p.add('lamp', m.lampOut, panes.map((g) => g.clone()), { when: 'shut', cast: false });
}
