/**
 * models/timberYard.js
 * ----------------------------------------------------------------------------
 * The timber yard (Silva Caedua) of the 3D look, on a 2 x 2 footprint
 * (8 m): a felling yard at the edge of the wood, from what is known of
 * Roman forestry and timber working, not from the 2D sprite:
 *
 *   - Vitruvius (II.9) on timber: felled in autumn to the beginning of
 *     spring, the tree cut half through and left standing to drain its sap
 *     before it is felled, then seasoned; and which woods suit which work.
 *     Pliny (Natural History 16) on trees, felling and the uses of each
 *     timber.
 *   - The tools of the Roman woodsmen (finds from Pompeii, the Saalburg and
 *     the Vindolanda hoard): the felling axe (securis), the adze (ascia),
 *     the wedge (cuneus) and the maul, the two-man saw (serra) and the frame
 *     saw, the saw pit and the sawyers of the reliefs (the Ravenna
 *     sarcophagus, the Haterii tomb): the trunk on trestles, one man on top
 *     and one below drawing a long saw up and down along a chalk line.
 *   - Logs hauled by oxen on a sledge or a four-wheeled cart with solid
 *     disc wheels; planks stacked on stickers to season in the open.
 *
 * So, on 8 m of earth strewn with sawdust: at the back-left a shed of poles
 * under thatch with a bench, a chopping block with the axes and the maul in
 * it, and a small stack of seasoned planks; at the back-right the store,
 * logs stacked between stakes and planks stacked on stickers (the stock, a
 * kit for each step); in the middle a felled trunk lying with its branches
 * half trimmed, a man limbing it with an axe; at the front-left the saw
 * pit, the log on two trestles and the two sawyers at their long saw; at
 * the front-right three stumps, an ox-sledge with a load of logs and the
 * wheels of a timber cart leaning on a stake.
 *
 * The pit of the saw pit is not sunk (the model sits on the street's
 * level): the trestles are high instead, the lower man on the ground and
 * the upper on the log, which draws the same line of saw.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the saw in the kerf between the sawyers, the lantern
 *           lit, and (actors, people/) the feller limbing, the upper and
 *           the lower sawyer at the saw
 *   'shut'  no staff: the saw leaning on the trestle, the lantern cold,
 *           nobody
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CircleGeometry, CylinderGeometry, TorusGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { slab } from './masonry.js';
import { beam, lin } from './rural.js';
import { Yard, YARD, BARK_LIGHT, bx, colour, pole, trunk, thatchGable, mound, seg } from './industryKit.js';

const F = YARD.floorY;

/** The yard's measures (metres): the tests and the actors read them. */
export const TIMBER_YARD = Object.freeze({
  shed: Object.freeze({ x0: -3.5, x1: -0.7, z0: -3.4, z1: -1.9, eaveY: 1.8, ridgeY: 2.75 }),
  // The felled trunk's butt and crown (x), its axis (z), the radius at the butt.
  trunk: Object.freeze({ x0: 0.35, x1: 3.55, z: -0.4, r: 0.27 }),
  // The feller's standing place: his axe lands on the trunk's near face.
  feller: Object.freeze([1.7, 0.5]),
  // The saw pit: the log's two ends (x), its axis (z) and top (y), the cut's x, the trestles' height.
  saw: Object.freeze({ x0: -3.5, end: -0.45, z: 2.2, top: 1.66, cut: -0.7, trestle: 1.2, r: 0.22 }),
  // The log stack (centres of its bottom row: z0 + k * pitch) and the plank stack.
  logs: Object.freeze({ x0: 0.4, x1: 3.6, z0: -3.5, pitch: 0.385, r: 0.19 }),
  planks: Object.freeze({ cx: 2.0, cz: -1.25, L: 3.0 }),
  /** The lantern on its bracket at the shed's front-right post (x, y, z). */
  lamp: Object.freeze([-0.55, 1.5, -1.65]),
});

const T = TIMBER_YARD;

/** A handled tool leaning from `base` to `tip` ([x, y, z]), its head (iron) across the top, `across` wide. */
function tool(y, base, tip, across, lod, seed, headY = 0.04) {
  y.add('wood', pole(base, tip, 0.022, lod, seed));
  y.add('iron', bx(across, headY, 0.035, tip[0], tip[1] - 0.06, tip[2], 0.95));
}

/** The shed of poles under thatch, with the bench, the planks, the chopping block and its axes. */
function shed(y, lod) {
  const s = T.shed;
  const xs = [s.x0 + 0.05, (s.x0 + s.x1) / 2, s.x1 - 0.05];
  const posts = [];
  for (const x of xs) for (const z of [s.z0 + 0.05, s.z1 - 0.05]) posts.push(pole([x, F, z], [x, s.eaveY, z], 0.075, lod, x * 5 + z));
  y.add('wood', posts);
  for (const z of [s.z0 + 0.05, s.z1 - 0.05]) y.add('wood', beam([s.x0 - 0.1, s.eaveY - 0.02, z], [s.x1 + 0.1, s.eaveY - 0.02, z], 0.13, z, lod));
  if (lod < 2) for (const x of xs) y.add('wood', beam([x, s.eaveY - 0.18, s.z0 - 0.1], [x, s.eaveY - 0.18, s.z1 + 0.1], 0.09, x + 2, lod));
  const roof = thatchGable({ ...s, over: 0.28, along: 'x', lod, seed: 71 });
  y.add('thatch', roof.thatch);
  y.add('wood', roof.wood);
  // The bench along the back: a thick top on four legs, an adze and a saw-set on it.
  const bz = s.z0 + 0.4;
  y.add('wood', slab(1.5, 0.08, 0.45, { bevel: 0.012, seed: 8, wobble: 0.002, tone: 0.06, grime: 0 }).translate(-2.8, 0.78, bz));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) y.add('wood', bx(0.08, 0.78 - F, 0.08, -2.8 + sx * 0.65, F, bz + sz * 0.15, 0.8));
  if (lod < 2) {
    y.add('wood', bx(0.5, 0.035, 0.12, -2.55, 0.86, bz, 0.85));
    y.add('iron', bx(0.14, 0.03, 0.05, -3.05, 0.86, bz, 0.9));
  }
  // The seasoned planks in the shed, sticked in a small stack.
  for (let k = 0; k < (lod === 2 ? 1 : 5); k++) {
    const h = lod === 2 ? 0.4 : 0.05;
    y.add('wood', bx(1.2, h, 0.46, -1.45, F + 0.08 + k * 0.09, -2.9, 0.78 + (k % 3) * 0.08));
    if (lod < 2) y.add('wood', [bx(0.04, 0.04, 0.46, -1.9, F + 0.08 + k * 0.09 + 0.05, -2.9, 0.6), bx(0.04, 0.04, 0.46, -1.0, F + 0.08 + k * 0.09 + 0.05, -2.9, 0.6)]);
  }
  y.add('wood', bx(1.2, 0.08, 0.5, -1.45, F, -2.9, 0.6));
  // The chopping block: a stump with the felling axes buried in its top, the maul and two wedges by it.
  const cb = { x: -3.15, z: -2.35, r: 0.29, h: 0.5 };
  const log = trunk([cb.x, F, cb.z], [cb.x, F + cb.h, cb.z], cb.r, lod, 3);
  y.add('wood', log.bark);
  y.add('wood', log.ends);
  if (lod < 2) {
    for (const [k, a] of [[0, 0.5], [1, 2.3], [2, 4.0]]) {
      const bx0 = cb.x + Math.cos(a) * 0.18;
      const bz0 = cb.z + Math.sin(a) * 0.18;
      const base = [bx0, F + cb.h + 0.05, bz0];
      const tip = [bx0 + Math.cos(a) * 0.32, F + cb.h + 0.68, bz0 + Math.sin(a) * 0.32];
      tool(y, base, tip, 0.16, lod, k, 0.12);
    }
    y.add('wood', bx(0.5, 0.04, 0.04, cb.x + 0.55, F + 0.04, cb.z + 0.15, 0.7));
    y.add('wood', bx(0.12, 0.12, 0.12, cb.x + 0.78, F, cb.z + 0.15, 0.75));
    for (const dx of [0, 0.18]) y.add('iron', bx(0.05, 0.04, 0.12, cb.x + 0.5 + dx, F, cb.z + 0.42, 0.85));
  }
  // The lantern and its bracket on the front-right post.
  const [lx, ly, lz] = T.lamp;
  y.add('wood', bx(0.3, 0.04, 0.26, lx, ly - 0.04, lz, 0.8));
  y.lantern(lx, ly, lz);
}

/** The felled trunk with its branches half trimmed, the cut limbs, the wedges and stumps and chips. */
function felled(y, lod) {
  const t = T.trunk;
  const cy = F + t.r * 0.95;
  const body = trunk([t.x0, cy, t.z], [t.x1, cy + 0.04, t.z], t.r, lod, 5);
  y.add('wood', body.bark);
  y.add('wood', body.ends);
  // Branch stubs along both sides: the knots left to trim, a few already cut flush.
  if (lod < 2) {
    const stubs = [[0.95, 1], [1.45, -1], [1.95, 1], [2.4, -1], [2.9, 1], [3.3, -1]];
    stubs.forEach(([x, s], k) => {
      const r = 0.05 - k * 0.004;
      const len = 0.18 + (k % 3) * 0.1;
      const a = [x, cy + 0.03, t.z + s * t.r * 0.8];
      const b = [x + 0.08, cy + 0.14, t.z + s * (t.r + len)];
      const st = trunk(a, b, r, lod, 9 + k);
      y.add('wood', st.bark);
      y.add('wood', st.ends);
    });
  }
  // Cut limbs lying on the ground by the feller.
  if (lod < 2) {
    const limbs = [[[2.9, F + 0.06, 0.95], [3.7, F + 0.09, 1.25], 0.05], [[3.0, F + 0.05, 0.65], [3.55, F + 0.07, 0.55], 0.04], [[1.0, F + 0.05, 1.05], [1.7, F + 0.07, 1.35], 0.045]];
    limbs.forEach(([a, b, r], k) => {
      const l = trunk(a, b, r, lod, 20 + k);
      y.add('wood', l.bark);
      y.add('wood', l.ends);
    });
  }
  // Three stumps at the yard's edge, the freshest one cut pale on top.
  [[3.15, 1.1, 0.3, 0.42], [3.5, 2.2, 0.23, 0.3], [0.65, 3.35, 0.21, 0.36]].forEach(([x, z, r, h], k) => {
    const st = new CylinderGeometry(r * 0.94, r * 1.25, h, seg(lod, 12, 8, 5), 1, true);
    st.translate(x, F + h / 2, z);
    y.add('wood', tintGeometry(boxUV(st), () => BARK_LIGHT * (0.7 + 0.1 * k)));
    y.add('wood', tintGeometry(boxUV(new CircleGeometry(r * 0.94, seg(lod, 12, 8, 5)).rotateX(-Math.PI / 2).translate(x, F + h + 0.003, z)), () => 1.05 - 0.12 * k));
  });
}

/** The sawyers' pit: two trestles, the log on them, the saw in its kerf (open) or leaning (shut), the sawdust. */
function sawPit(y, lod) {
  const s = T.saw;
  // The trestles: a bolster across the top, two splayed legs and a brace each.
  for (const x of [s.x0 + 0.55, s.end - 0.45]) {
    y.add('wood', bx(0.16, 0.14, 1.0, x, s.trestle - 0.1, s.z, 0.82));
    for (const d of [-1, 1]) {
      y.add('wood', pole([x, F, s.z + d * 0.55], [x, s.trestle - 0.08, s.z + d * 0.12], 0.05, lod, d + x));
    }
    if (lod < 2) y.add('wood', bx(0.05, 0.05, 0.9, x, 0.45, s.z, 0.7));
  }
  const log = trunk([s.x0, s.top - s.r, s.z], [s.end, s.top - s.r, s.z], s.r, lod, 11);
  y.add('wood', log.bark);
  y.add('wood', log.ends);
  // The chalk line for the cut, and the kerf started at the end: a dark slit and a little pale dust under it.
  if (lod < 2) {
    y.add('wood', bx(s.end - s.x0 - 0.3, 0.004, 0.015, (s.x0 + s.end) / 2 - 0.1, s.top - 0.002, s.z, 1.5));
    y.add('dark', bx(0.6, 0.02, 0.025, s.end - 0.32, s.top - 0.012, s.z, 0.5));
  }
  // The sawdust under the cut: a pale heap and a drift across the ground.
  const dust = mound(0.42, 0.14, 4, lod);
  y.add('earth', colour(dust, lin(0xe8d6a8)).translate(s.cut, F, s.z));
  const drift = new CircleGeometry(0.9, seg(lod, 16, 10, 6));
  drift.rotateX(-Math.PI / 2);
  drift.scale(1.4, 1, 0.8);
  drift.translate(s.cut - 0.1, F + 0.004, s.z);
  y.add('earth', colour(tintGeometry(boxUV(drift)), lin(0xe8d4a4)), 'always', false);
  // The saw: a long blade between a tiller handle at the top and a box handle at the bottom, in the
  // kerf (vertical, between the men's hands) while it works, leaning on the trestle when it does not.
  const bottom = F + 1.02;
  const top = s.top + 1.02;
  y.add('iron', bx(0.012, top - bottom, 0.15, s.cut, bottom, s.z, 1), 'open');
  y.add('wood', [bx(0.045, 0.045, 0.4, s.cut, top, s.z, 0.8), bx(0.06, 0.06, 0.34, s.cut, bottom - 0.06, s.z, 0.75)], 'open');
  // At rest: the saw standing against the nearer trestle's bolster, blade out.
  const a = [s.end - 0.7, F, s.z + 0.95];
  const b = [s.end - 0.55, F + 1.7, s.z + 0.2];
  y.add('iron', pole(a, b, 0.008, 2, 1), 'shut');
  y.add('wood', pole([b[0], b[1] - 0.03, b[2] - 0.15], [b[0], b[1] - 0.03, b[2] + 0.15], 0.022, 2, 2), 'shut');
}

/** The sledge: two runners turned up at the front, cross bearers, a load of logs, the draught pole and yoke bar. */
function sledge(y, lod) {
  const cx = 1.95;
  const z0 = 1.5;
  const z1 = 3.5;
  for (const s of [-1, 1]) {
    y.add('wood', bx(0.12, 0.13, z1 - z0, cx + s * 0.45, F, (z0 + z1) / 2, 0.78));
    y.add('wood', pole([cx + s * 0.45, F + 0.06, z1 - 0.05], [cx + s * 0.45, F + 0.35, z1 + 0.12], 0.06, lod, s));
  }
  for (let k = 0; k < (lod === 2 ? 2 : 4); k++) y.add('wood', bx(1.2, 0.07, 0.1, cx, F + 0.13, z0 + 0.25 + k * 0.5, 0.7));
  // Its load: two logs and a third on them, the butts toward the back.
  [[-0.17, 0, 0.17], [0.17, 0, 0.17], [0, 0.3, 0.15]].forEach(([dx, dy, r], k) => {
    const l = trunk([cx + dx, F + 0.2 + r + dy, z0 + 0.12 - k * 0.08], [cx + dx, F + 0.2 + r + dy + 0.02, z1 - 0.2 + k * 0.05], r, lod, 40 + k);
    y.add('wood', l.bark);
    y.add('wood', l.ends);
  });
  // The pole forward to the yoke bar across: a draught pole for the oxen.
  y.add('wood', pole([cx, F + 0.3, z1 - 0.1], [cx, F + 0.55, z1 + 0.35], 0.04, lod, 2));
}

/** The wheels of a timber cart, solid discs of three planks with a hub and an iron tyre, leaning on a stake. */
function wheels(y, lod) {
  const R = 0.5;
  const x = 3.3;
  for (const [z, lean] of [[3.52, 0.12], [3.32, 0.12]]) {
    const w = new CylinderGeometry(R, R, 0.09, seg(lod, 22, 14, 8), 1);
    w.rotateX(Math.PI / 2);
    w.translate(0, 0, 0);
    w.rotateX(-lean);
    w.translate(x, F + R * Math.cos(lean), z);
    y.add('wood', tintGeometry(boxUV(w), (px, py) => 0.82 + 0.12 * Math.cos(Math.atan2(py - (F + R), px - x) * 3)));
    if (lod < 2) {
      const tyre = new TorusGeometry(R, 0.017, 4, seg(lod, 28, 18, 10));
      tyre.rotateX(-lean);
      tyre.translate(x, F + R * Math.cos(lean), z);
      y.add('iron', tintGeometry(boxUV(tyre), () => 0.9));
      const hub = new CylinderGeometry(0.1, 0.1, 0.16, 10, 1);
      hub.rotateX(Math.PI / 2);
      hub.rotateX(-lean);
      hub.translate(x, F + R * Math.cos(lean), z);
      y.add('wood', tintGeometry(boxUV(hub), () => 0.7));
    }
  }
  y.add('wood', pole([x + 0.55, F, 3.7], [x + 0.55, 1.2, 3.7], 0.045, lod, 5));
}

/** The log stack's stakes and bearers and the planks' bearers: what stands whatever the store holds. */
function frames(y, lod) {
  const l = T.logs;
  const stakes = [];
  for (const x of [l.x0 - 0.05, l.x1 + 0.05]) for (const z of [l.z0 - 0.25, l.z0 + 4 * l.pitch + 0.25]) stakes.push(pole([x, F, z], [x, 1.0, z], 0.045, lod, x + z));
  y.add('wood', stakes);
  const p = T.planks;
  for (const dx of [-1.2, 0, 1.2]) y.add('wood', bx(0.12, 0.1, 0.7, p.cx + dx, F, p.cz, 0.7));
  // The wood's own chips about the trunk and the stumps.
  if (lod === 0) {
    for (let k = 0; k < 18; k++) {
      const a = k * 2.399;
      const r = 0.5 + (k % 5) * 0.28;
      const px = Math.max(-3.8, Math.min(3.8, 1.9 + Math.cos(a) * r * 1.5));
      const pz = Math.max(-3.8, Math.min(3.8, 0.1 + Math.sin(a) * r * 0.8));
      y.add('wood', bx(0.09, 0.02, 0.05, px, F, pz, 1.2));
    }
  }
}

/** Build the timber yard: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildTimberYard({ lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const y = new Yard('timber_yard', lod);
  // The yard: earth gone pale with sawdust and chippings round the work.
  y.add('earth', colour(slab(2 * YARD.half - 0.1, F, 2 * YARD.half - 0.1, { bevel: 0.01, seed: 2, wobble: 0, tone: 0, grime: 0 }), lin(0xdccfb0)));
  shed(y, lod);
  felled(y, lod);
  sawPit(y, lod);
  sledge(y, lod);
  wheels(y, lod);
  frames(y, lod);
  return y.build();
}

/**
 * The store at step 1 to 3 (a third, two thirds, full): logs stacked in
 * rows between the stakes (5, then 4 and 3 on them, then 2), and planks
 * stacked on stickers (3, 7, then 11 courses).
 */
export function buildTimberStock(step, { lod = 0 } = {}) {
  const y = new Yard('timber_yard_stock', lod);
  const l = T.logs;
  const rows = [[5], [5, 4], [5, 4, 3, 2]][Math.max(1, Math.min(3, step)) - 1];
  rows.forEach((n, k) => {
    for (let i = 0; i < n; i++) {
      const z = l.z0 + (i + (5 - n) / 2) * l.pitch;
      const yy = F + l.r + k * l.pitch * 0.866;
      const jit = ((i * 7 + k * 3) % 5) * 0.03;
      const g = trunk([l.x0 + jit, yy, z], [l.x1 - 0.1 + jit * 0.5, yy, z], l.r, lod, 60 + k * 9 + i);
      y.add('wood', g.bark);
      y.add('wood', g.ends);
    }
  });
  const p = T.planks;
  const courses = [0, 3, 7, 11][Math.max(1, Math.min(3, step))];
  const y0 = F + 0.1;
  if (lod === 2) {
    y.add('wood', bx(p.L, courses * 0.09, 0.6, p.cx, y0, p.cz, 0.9));
  } else {
    for (let c = 0; c < courses; c++) {
      const cy = y0 + c * 0.09;
      // (Two boards a course side by side, their lengths and tones a little unlike; stickers between courses.)
      for (const s of [-1, 1]) y.add('wood', bx(p.L - ((c * 3 + (s + 1)) % 4) * 0.05, 0.05, 0.28, p.cx + (((c + s) % 3) - 1) * 0.02, cy + 0.04, p.cz + s * 0.15, 0.82 + ((c * 5 + s * 3 + 9) % 4) * 0.07));
      if (lod === 0) for (const dx of [-1.2, 0, 1.2]) y.add('wood', bx(0.05, 0.04, 0.62, p.cx + dx, cy, p.cz, 0.65));
    }
  }
  return y.build();
}

/**
 * The yard's people while it is staffed (people/actors.js specs, its
 * metres): the feller limbing the trunk with his axe, the upper sawyer
 * standing on the log and the lower on the ground, both at the long saw.
 * Nobody when it is idle.
 */
export function timberYardActors(state) {
  if (state !== 'open') return [];
  const s = T.saw;
  const [fx, fz] = T.feller;
  const tunic = { body: 'm', dress: ['tunic:short'], hair: 'crop' };
  return [
    { ...tunic, clip: 'hoe', props: { R: 'axe' }, at: [fx, F, fz], ry: Math.PI, seed: 311, colours: { tunic: 0x8a7a5a } },
    // The upper man on the log, facing the saw and the lower man; both draw the same saw (the clip's hands ahead of each).
    { ...tunic, hair: 'curls', clip: 'pump', at: [s.cut - 0.4, s.top, s.z], ry: Math.PI / 2, seed: 312, colours: { tunic: 0xa8977a } },
    { ...tunic, hair: 'bald', clip: 'pump', at: [s.cut + 0.4, F, s.z], ry: -Math.PI / 2, seed: 313, colours: { tunic: 0x6e604f } },
  ];
}
