/**
 * models/fanumPeople.js
 * ----------------------------------------------------------------------------
 * The Great Sanctuary's people and its building site (models/fanum.js):
 *
 *   - At work ('open'): the priest of the summit temple at his altar with
 *     his boy and a woman praying (the temples' rite: aedes.js
 *     templeActors, on the summit); a procession along the lower terrace
 *     (Ara Pacis's: the priest velatus, the flute player, girls bearing
 *     offerings on their heads, a boy with the incense box), walking in
 *     step and stopping to pray at its end; worshippers on the stairs'
 *     landings; each god's own: Ceres's women with baskets in the grove,
 *     Neptune's fishermen at the basins, Mercury's traders at their
 *     stalls, Mars's soldiers by the sacred spears, Venus's women among
 *     the roses.
 *   - On the god's feast ('out'): the sacrifice at the summit (the
 *     victimarius, the flute, the crowd), the procession and a crowd
 *     cheering on the middle terrace.
 *   - The building crew while a work camp's crew is on the site, by stage:
 *     masons dressing stone at the face rising, men carrying, a man at the
 *     crane's windlass; gardeners and a sculptor at the dedication.
 *
 * And the site's dressing for the shared construction site
 * (models/worksite.js siteParts): scaffolds against what rises, the cranes,
 * the arches' centering, the goods delivered in piles.
 *
 * Metres, the sanctuary's frame (fanum.js: the footprint's middle at the
 * origin, y up, +z the street).
 * ----------------------------------------------------------------------------
 */

import { DYES } from '../people/actors.js';
import { WINDLASS } from '../people/clips.js';
import { column } from './domus.js';
import { TaggedParts } from './masonry.js';
import { sacraMaterials } from './sacra.js';
import { templeActors } from './aedes.js';
import { FANUM, FANUM_TEMPLE, TEMPLE_AT, grow } from './fanum.js';

const { t1, t2, t3 } = FANUM;
const Y1 = t1.y + 0.03;
const Y2 = t2.y + 0.03;
const Y3 = t3.y + 0.03;

/** Actor specs moved by (dx, dy, dz) (a temple's people onto the summit). */
function moved(list, [dx, dy, dz]) {
  return list.map((a) => ({ ...a, at: [a.at[0] + dx, a.at[1] + dy, a.at[2] + dz] }));
}

/** The porticoes' column (the god's order), standing on y 0: { group }. */
export function buildPorticoColumn(order, { lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const m = sacraMaterials();
  const p = new TaggedParts(`fanum-portico-${order}`);
  const c = column(order === 'tuscan' ? 'pompeian' : order, FANUM.porticus.colH, lod);
  p.add('column', order === 'tuscan' ? m.stucco : m.marble, c.stone);
  p.add('capital', m.marble, c.cap);
  return p.build();
}

/**
 * A procession on the forecourt, heading for a ramp's foot (`side` -1 the
 * left, +1 the right): the file walks out from the axis in step (sync),
 * stops to pray and play at its end, and turns back.
 */
function procession(side, n, seed, { length = 3.4 } = {}) {
  const ry = side < 0 ? -Math.PI / 2 : Math.PI / 2;
  const z = 9.15;
  const roles = [
    { body: 'm', dress: ['tunic:long', 'toga:velato'], hair: 'bald', old: true, props: { R: 'patera' }, clipEnd: 'pray', colours: { tunic: DYES.white, mantle: DYES.candida } },
    { body: 'm', dress: ['tunic:long', 'wreath'], hair: 'crop', props: { R: 'tibiae' }, clipEnd: 'flute', colours: { tunic: DYES.white } },
    { body: 'f', dress: ['tunic:long:stola', 'wreath'], hair: 'bun', props: { L: 'jar' }, clip: 'jarCarry', clipEnd: 'jarStand', colours: { tunic: DYES.candida, leather: 0xa4552e } },
    { body: 'f', dress: ['tunic:long:stola', 'wreath'], hair: 'bun', props: { L: 'jar' }, clip: 'jarCarry', clipEnd: 'jarStand', colours: { tunic: DYES.saffron, leather: 0xa4552e } },
    { body: 'c', dress: ['tunic:knee', 'bulla'], hair: 'curls', props: { R: 'acerra' }, clipEnd: 'hold', colours: { tunic: DYES.white, trim: DYES.white } },
    { body: 'm', dress: ['tunic:knee', 'toga', 'wreath'], hair: 'curls', clipEnd: 'pray', colours: { mantle: DYES.candida } },
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = roles[i % roles.length];
    // In file a pace apart, the leader farthest out, all keeping the building's time (sync).
    const x = side * (1.0 + (n - 1 - i) * 1.0);
    out.push({
      ...r, clip: r.clip || 'walk', at: [x, 0.03, z], ry, seed: seed + i, sync: true, phase: 0,
      route: { length, speed: 0.5, pauseEnd: 9, pauseStart: 6, clipEnd: r.clipEnd || 'idle', clipStart: r.clipEnd || 'idle', faceEnd: ry, faceStart: ry + Math.PI },
    });
  }
  return out;
}

/** Each god's own people on the lower terrace's wings. */
function godsPeople(god) {
  const y = Y1;
  switch (god) {
    case 'ceres':
      return [
        { body: 'f', dress: ['tunic:long:stola', 'palla:veil'], hair: 'bun', props: { L: 'jar' }, clip: 'jarCarry', at: [-7.8, y, 5.2], ry: Math.PI / 2, seed: 81, colours: { leather: 0xb08a50 }, route: { length: 3.2, speed: 0.6, pauseEnd: 5, pauseStart: 6, clipEnd: 'jarStand', clipStart: 'jarStand' } },
        { body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'pray', at: [-3.3, y, 6.35], ry: Math.PI, seed: 82, colours: { tunic: DYES.fawn } },
        { body: 'f', dress: ['tunic:long:stola', 'palla'], hair: 'bun', clip: 'give', at: [3.3, y, 6.35], ry: Math.PI, seed: 83 },
      ];
    case 'neptune':
      return [
        { body: 'm', dress: ['tunic:short'], hair: 'curls', beard: 'short', clip: 'pray', at: [-5.9, y, 6.45], ry: Math.PI, seed: 84, colours: { tunic: DYES.woad } },
        { body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'give', at: [5.9, y, 6.45], ry: Math.PI, seed: 85, colours: { tunic: DYES.sky } },
        { body: 'c', dress: ['tunic:knee'], hair: 'curls', clip: 'cheer', at: [7.4, y, 6.4], ry: Math.PI + 0.4, seed: 86 },
      ];
    case 'mercury':
      return [
        { body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'count', at: [-3.6, y, 3.5], ry: 0, seed: 87, colours: { tunic: DYES.madder } },
        { body: 'f', dress: ['tunic:long:stola', 'palla'], hair: 'bun', clip: 'talk', at: [-3.6, y, 4.85], ry: Math.PI, seed: 88 },
        { body: 'm', dress: ['tunic:knee'], hair: 'curls', clip: 'give', at: [3.6, y, 3.5], ry: 0, seed: 89, colours: { tunic: DYES.weld } },
        { body: 'm', dress: ['tunic:knee', 'toga'], hair: 'crop', clip: 'listen', at: [3.75, y, 4.85], ry: Math.PI, seed: 90, colours: { mantle: DYES.candida } },
        { body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'count', at: [5.75, y, 3.5], ry: 0, seed: 91, colours: { tunic: DYES.green } },
      ];
    case 'mars':
      return [
        { body: 'm', dress: ['tunic:knee', 'lorica', 'caligae', 'helmet'], hair: 'crop', props: { R: 'spear', L: 'scutum' }, clip: 'guard', at: [2.55, y, 6.45], ry: Math.PI, seed: 92, colours: { tunic: DYES.madder } },
        { body: 'm', dress: ['tunic:knee', 'lorica', 'caligae', 'helmet'], hair: 'crop', props: { R: 'spear', L: 'scutum' }, clip: 'guard', at: [5.35, y, 6.45], ry: Math.PI, seed: 93, colours: { tunic: DYES.madder } },
        { body: 'm', dress: ['tunic:knee', 'toga'], hair: 'bald', old: true, clip: 'pray', at: [-4.6, y, 5.0], ry: Math.PI, seed: 94, colours: { mantle: DYES.candida } },
      ];
    default:
      return [
        { body: 'f', dress: ['tunic:long:stola', 'palla:veil'], hair: 'bun', clip: 'pray', at: [-5.6, y, 5.4], ry: Math.PI, seed: 95, colours: { tunic: DYES.rose } },
        { body: 'f', dress: ['tunic:long:stola', 'palla'], hair: 'bun', clip: 'talk', at: [5.5, y, 5.6], ry: -Math.PI / 2, seed: 96, colours: { tunic: DYES.sky } },
        { body: 'f', dress: ['tunic:long:stola'], hair: 'bun', clip: 'listen', at: [4.8, y, 5.6], ry: Math.PI / 2, seed: 97, colours: { tunic: DYES.saffron } },
        { body: 'c', dress: ['tunic:knee'], hair: 'curls', clip: 'cheer', at: [-3.0, y, 6.4], ry: Math.PI, seed: 98 },
      ];
  }
}

/**
 * The people of a Great Sanctuary at work, by its state: 'open' (the rite,
 * the procession, the god's own) or 'out' (the god's feast: the
 * sacrifice and its crowd, a longer procession, a crowd on the middle
 * terrace). Nobody when it is shut.
 */
export function fanumActors(god, state) {
  if (state !== 'open' && state !== 'out') return [];
  const list = moved(templeActors(FANUM_TEMPLE, state), TEMPLE_AT);
  const feast = state === 'out';
  list.push(...procession(-1, feast ? 6 : 4, 300));
  if (feast) list.push(...procession(1, 5, 320));
  list.push(...godsPeople(god));
  // Worshippers on the stairs' landings and the middle terrace.
  list.push({ body: 'm', dress: ['tunic:knee', 'toga'], hair: 'crop', clip: 'walk', at: [2.2, Y2, 1.9], ry: -Math.PI / 2, seed: 340, colours: { mantle: DYES.candida }, route: { length: 4.2, speed: 0.6, pauseEnd: 6, pauseStart: 5, clipEnd: 'listen', clipStart: 'talk' } });
  list.push({ body: 'f', dress: ['tunic:long:stola', 'palla:veil'], hair: 'bun', clip: 'pray', at: [-2.4, Y2, 0.1], ry: Math.PI, seed: 341 });
  if (feast) {
    const acts = ['cheer', 'cheer', 'talk', 'pray', 'cheer', 'listen', 'cheer'];
    for (let i = 0; i < 7; i++) {
      const s = i % 2 ? 1 : -1;
      list.push({ body: i % 3 === 1 ? 'f' : 'm', dress: i % 3 === 1 ? ['tunic:long:stola', 'palla', 'wreath'] : ['tunic:knee', 'wreath'], hair: i % 3 === 1 ? 'bun' : 'crop', clip: acts[i], at: [s * (2.2 + (i >> 1) * 1.3), Y2, 0.6 + (i % 3) * 0.55], ry: Math.PI + s * 0.3, seed: 350 + i });
    }
  }
  return list;
}

/** A builder: a tunic of undyed or brown wool. */
function builder(seed, extra) {
  const tones = [DYES.undyed, DYES.oatmeal, DYES.fawn, DYES.brownWool, DYES.ochre];
  return { body: 'm', dress: ['tunic:short'], hair: seed % 3 ? 'crop' : 'curls', seed, colours: { tunic: tones[seed % tones.length] }, ...extra };
}

/** Masons dressing the face of what rises (facing -z, before a face at z), along x. */
function masons(xs, y, z, seed) {
  return xs.map((x, i) => builder(seed + i, { clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [x, y, z], ry: Math.PI }));
}

/** Men carrying along x from x0 (facing +x if `dir` 1), `length` metres and back. */
function carriers(x0, y, z, dir, length, seed, n = 2) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(builder(seed + i, {
      clip: 'carry', props: { L: 'sack' }, at: [x0 + dir * i * 1.6, y, z + i * 0.3], ry: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      route: { length, speed: 0.75, pauseEnd: 3, pauseStart: 4, clipEnd: 'shoulder', clipStart: 'shoulder', faceEnd: Math.PI, faceStart: 0 },
    }));
  }
  return out;
}

/** The crew on the site by the stage under way: stone dressed at the rising face, goods carried, the crane worked. */
export function fanumCrew(stage) {
  const list = [];
  if (stage === 0) {
    list.push(...masons([-6.5, -3.2, 3.6, 6.8], 0.03, t1.z1 + 1.65, 600));
    list.push(...carriers(-8.4, 0.03, 9.0, 1, 6.5, 610));
    list.push(builder(615, { clip: 'windlass', props: { R: 'crank' }, at: [5.6 - WINDLASS.x, 0.03, 8.9 - WINDLASS.ahead], ry: 0 }));
  } else if (stage === 1) {
    list.push(...masons([-6.8, -4.0, 4.2, 7.1], Y1, t2.z1 + 0.5, 620));
    list.push(...carriers(-8.6, Y1, 5.2, 1, 5.8, 630));
    list.push(builder(635, { clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [-1.2, Y3 * 0 + Y2, -0.6], ry: Math.PI }));
    list.push(builder(636, { clip: 'windlass', props: { R: 'crank' }, at: [3.0 - WINDLASS.x, Y1, 5.6 - WINDLASS.ahead], ry: 0 }));
  } else if (stage === 2) {
    list.push(...masons([-3.6, 3.6], Y3, TEMPLE_AT[2] + 3.9, 640));
    list.push(...carriers(-5.8, Y3, -2.4, 1, 4.2, 645));
    list.push(builder(649, { clip: 'windlass', props: { R: 'crank' }, at: [4.6 - WINDLASS.x, Y3, -2.9 - WINDLASS.ahead], ry: 0 }));
    list.push(...masons([-7.5, 7.5], Y2, 0.9, 650));
  } else {
    // The dedication: a sculptor at the temple's steps, gardeners planting, wine and oil carried up.
    list.push(builder(660, { clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [-3.4, Y3, TEMPLE_AT[2] + 2.9], ry: -Math.PI / 2 }));
    list.push(builder(661, { clip: 'hoe', props: { R: 'hoe' }, at: [-6.4, Y1, 4.6], ry: 0.3 }));
    list.push(builder(662, { clip: 'hoe', props: { R: 'hoe' }, at: [6.6, Y1, 4.9], ry: -0.4 }));
    list.push(builder(663, { clip: 'jarCarry', props: { L: 'jar' }, at: [-8.2, Y1, 6.1], ry: Math.PI / 2, colours: { tunic: DYES.oatmeal, leather: 0xa4552e }, route: { length: 5.4, speed: 0.6, pauseEnd: 3, pauseStart: 4, clipEnd: 'jarStand', clipStart: 'jarStand' } }));
  }
  return list;
}

/**
 * The site's dressing at timeline `t` (sacredMonuments.js), with the goods
 * in `piles` ({ good: 0..3 }), for the shared construction site
 * (worksite.js siteParts): scaffolds against the faces rising, the cranes
 * (a treadwheel for the heavy lifts, shear legs for the lighter), the
 * arches' centering, the piles, the crew.
 */
export function fanumSite(t, piles = {}) {
  const site = { scaffolds: [], cranes: [], centering: [], piles: [], crew: [] };
  const stage = Math.floor(t);
  const X = FANUM.side;
  if (stage === 0) {
    // The lower face rising: a low scaffold along it, a treadwheel at the front.
    if (grow(t, 'lower') > 0.3) for (const x of [-6, 0, 6]) site.scaffolds.push({ x, z: t1.z1 + 0.7, w: 5.2, d: 1.0, h: 2.2, ry: 0 });
    site.cranes.push({ x: 5.6, z: 8.9, ry: 0, h: 5.0, kind: 'treadwheel' });
  } else if (stage === 1) {
    // The middle and top faces, scaffolded; the arches turned on centering; a treadwheel on the lower terrace.
    for (const x of [-6.2, -2.4, 2.4, 6.2]) site.scaffolds.push({ x, z: t2.z1 + 0.6, w: 3.4, d: 0.9, h: (t2.y - t1.y) + 1.4, ry: 0, y: t1.y });
    if (grow(t, 'upper') > 0) for (const x of [-6.2, -2.4, 2.4, 6.2]) site.scaffolds.push({ x, z: t3.z1 + 0.6, w: 3.4, d: 0.9, h: (t3.y - t2.y) + 1.4, ry: 0, y: t2.y });
    const arches = (y0, z, spring, n) => {
      for (const s of [-1, 1]) {
        const xa = s > 0 ? FANUM.stairW + 0.15 : -X;
        const xb = s > 0 ? X : -FANUM.stairW - 0.15;
        const L = xb - xa;
        const pier = (L / n) * 0.34;
        const span = L / n - pier;
        for (let k = 0; k < n; k++) site.centering.push({ x: xa + pier / 2 + (k + 0.5) * (L / n), z: z - 0.3, ry: 0, span, rise: span / 2, depth: 0.6, y: y0 + spring });
      }
    };
    if (grow(t, 'middle') > 0.3) arches(t1.y, t2.z1, 0.85, 4);
    if (grow(t, 'upper') > 0.3) arches(t2.y, t3.z1, 0.7, 4);
    site.cranes.push({ x: 3.0, z: 5.6, ry: Math.PI, h: 6.5, kind: 'treadwheel', y: t1.y });
  } else if (stage === 2) {
    // The temple and the porticoes: scaffolds round the cella and along the porticoes, a treadwheel lifting drums.
    const [ox, , oz] = TEMPLE_AT;
    const [CX, CZ1, CZ0] = FANUM_TEMPLE.cella;
    site.scaffolds.push({ x: ox, z: oz + CZ0 - 0.6, w: 2 * CX + 1.4, d: 0.9, h: 6.0, ry: 0, y: t3.y });
    for (const s of [-1, 1]) site.scaffolds.push({ x: ox + s * (CX + 0.9), z: oz + (CZ1 + CZ0) / 2, w: 0.9, d: CZ1 - CZ0 + 1.0, h: 6.0, ry: 0, y: t3.y });
    for (const s of [-1, 1]) site.scaffolds.push({ x: s * 8.1, z: -5.9, w: 2.4, d: 6.6, h: 3.4, ry: 0, y: t3.y });
    site.cranes.push({ x: 4.6, z: -2.9, ry: Math.PI, h: 7.5, kind: 'treadwheel', y: t3.y });
    site.cranes.push({ x: -4.4, z: -3.0, ry: 0.4, h: 5.5, kind: 'shear', y: t3.y });
  } else {
    // The dedication: the last scaffold at the temple's front for the gilders, coming down.
    const [ox, , oz] = TEMPLE_AT;
    if (t < 3.6) site.scaffolds.push({ x: ox, z: oz + FANUM_TEMPLE.porchZ + 0.75, w: 6.4, d: 0.8, h: 5.6, ry: 0, y: t3.y });
  }
  // The goods delivered, in piles on the forecourt and the lower terrace's front.
  const spots = { clay: [-5.0, 8.7, 0.1], timber: [-2.3, 9.0, -0.15], marble: [2.6, 8.8, 0.2], iron: [5.0, 8.9, -0.1] };
  for (const [good, n] of Object.entries(piles)) {
    const s = spots[good];
    if (s && n > 0) site.piles.push({ x: s[0], z: s[1], ry: s[2], good, n });
  }
  site.crew = fanumCrew(stage);
  return site;
}
