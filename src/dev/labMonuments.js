/**
 * labMonuments.js
 * ----------------------------------------------------------------------------
 * The look lab's Monuments scene (Shift+W): the work camp in each state, the
 * Hall of Justice at its stages and finished, and the building site's pieces
 * (render3d/models/worksite.js) one by one, labelled. The camps and the
 * basilicas are drawn through the game's own entries (models/monumentModels.js:
 * every look and every `more` kit a variant asks for, built by models.js
 * modelFor; the people by the game's batch), on a made-up map with a
 * made-up game, so what shows here is what the game draws: the cranes turn
 * by the clock as the game's do.
 *
 * L: the level of detail. V: the camera close on the next item (orbit).
 * window.__lab.monuments: closeUp(i), items, where(i), triangles(l), setLod(n).
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry, Matrix4 } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { modelFor, partShows, modelMatrix, MODELS } from '../render3d/models.js';
import { BUILDINGS } from '../data/buildings.js';
import { MONUMENT_TYPES } from '../data/monuments.js';
import { PeopleBatch } from '../render3d/people/batch.js';
import { cast } from '../render3d/people/actors.js';
import { siteGroup, siteMotion, siteActors, buildSitePart, crewMason, crewCarrier, crewMixer } from '../render3d/models/worksite.js';

const TILE = 4;
const MAP_W = 32;
const MAP_H = 24;

/** A basilica at quarter q of its building (16 finished), and its state's options. */
const bas = (x, y, q, name, note, o = {}) => ({ type: 'basilica', x, y, q, name, note, ...o });
const camp = (x, y, name, note, o = {}) => ({ type: 'work_camp', x, y, name, note, ...o });

/** What stands where (map tiles, its top-left), its label. */
const ITEMS = [
  bas(0, 0, 0, 'Hall of Justice: foundations begun', 'The plan set out with stakes and cords, the trenches dug'),
  bas(6, 0, 3, 'Foundations, three quarters', 'The podium\'s concrete core rising in its shuttering'),
  bas(12, 0, 5, 'Walls and piers, a quarter', 'Brick courses, putlog holes, column drums stacked'),
  bas(18, 0, 6, 'Walls and piers, half', 'The scaffolds a lift over the courses, the apse arch on its centering'),
  bas(24, 0, 7, 'Walls and piers, three quarters', 'The columns stand fluted, the clerestory begun'),
  bas(0, 6, 9, 'The roof, a quarter', 'The clerestory topped out, the first trusses'),
  bas(6, 6, 11, 'The roof, three quarters', 'Trusses along the nave, the aisles tiled'),
  bas(12, 6, 12, 'The tribunal begun', 'The apse\'s half dome on its centering'),
  bas(18, 6, 14, 'The tribunal, half', 'The half dome cast, the tribunal raised'),
  bas(24, 6, 16, 'Hall of Justice (basilica)', 'Finished and sitting: advocates, litigants, the money changer'),
  bas(0, 12, 16, 'Hall of Justice', 'Finished, closed: too few hands', { shut: true }),
  bas(6, 12, 16, 'Hall of Justice', 'Sacked by raiders: doors broken, rubble', { sacked: true }),
  bas(12, 12, 6, 'Walls and piers', 'Struck by raiders: scaffolds down, rubble', { struck: true }),
  bas(18, 12, 6, 'Walls and piers', 'Halted: no crew, the crane still', { halted: true }),
  camp(24, 12, 'Work Camp (Castra Operarum)', 'Crew at home: the fire, the sheds at work'),
  camp(28, 12, 'Work Camp', 'Crew out at the site: the clerk and the cook stay', { out: true }),
  camp(24, 16, 'Work Camp', 'No food and no water: the fire cold, the jars empty', { fed: false, water: false }),
  camp(28, 16, 'Work Camp', 'Idle: no staff', { shut: true }),
];

/** The site's pieces one by one (metres in the scene), a label each. */
const PIECES = [
  { name: 'Scaffold', note: 'Standards, ledgers, putlogs, boards, braces, a ladder', site: { scaffolds: [{ x: 0, z: 0, w: 6, d: 2.4, h: 6, ry: 0 }] }, crew: [crewMason([0, 6.07, 1.2 - 0.85 + 0.45], Math.PI, 901)] },
  { name: 'Scaffold toppled', note: 'Brought down by raiders', site: { scaffolds: [{ x: 0, z: 0, w: 6, d: 2.4, h: 6, ry: 0, fallen: true }] } },
  { name: 'Treadwheel crane at work', note: 'The Haterii relief\'s: a man in the wheel, the polyspastos lifting', site: { cranes: [{ x: 0, z: -2, ry: 0, h: 10, kind: 'treadwheel', work: true }] } },
  { name: 'Treadwheel crane, still', note: 'Its load at rest on rollers', site: { cranes: [{ x: 0, z: -2, ry: 0, h: 9, kind: 'treadwheel', load: 'drum' }] } },
  { name: 'Shear legs at work', note: 'Vitruvius X.2.1: the winder at the windlass', site: { cranes: [{ x: 0, z: 0.5, ry: 0, h: 5, kind: 'shear', work: true }] } },
  { name: 'Arch centering', note: 'Ribs, lagging, props on folding wedges', site: { centering: [{ x: 0, z: 0, ry: 0, span: 4, rise: 2, depth: 2, y: 2.5 }] } },
  { name: 'Dome centering', note: 'Ribs to the oculus ring, the tower, half lagged', site: { centering: [{ x: 0, z: 0, dome: 4, y: 1.5, lag: 0.5 }] } },
  { name: 'Mortar pit and rubble', note: 'Slaked lime and pozzolana; a raid\'s broken stone', site: { mortar: [{ x: -1.2, z: -1, ry: 0 }], rubble: [{ x: 0.5, z: 1.8, w: 3, d: 1.6 }] }, crew: [crewMixer([-1.35, 0.03, -1.95], 0, 902), crewCarrier([-3, 0.03, 3.2], Math.PI / 2, 5, 903, 'basket')] },
];
/** The piles, each good its pile of three loads. */
const PILE_GOODS = ['marble', 'timber', 'clay', 'iron', 'stone', 'wine', 'oil', 'furniture', 'linen', 'food'];

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The monuments' building sites, the work camp and the Hall of Justice</h2>
<p><b>The building site</b>, shared by every monument: scaffolds of poles lashed to ledgers, putlogs into the holes left in the wall
for them (Rome's walls are still pocked with their rows), boards at each lift, ladders; the treadwheel crane of the Haterii relief, a
jib on two legs held by stays, men walking in its great wheel, the polyspastos of Vitruvius (X.2) lifting a block on a lewis; shear
legs and a windlass; timber centering under arches and domes; marble, timber, bricks and tiles, iron in stacks; a mortar pit.</p>
<p><b>The work camp</b> (<i>Castra Operarum</i>): the contractor's yard by the works: the masons' and the carpenters' sheds, the
crews' goatskin tents (the army's papiliones), the clerk's hut with the plans on his table and the groma, the kitchen fire, the
water jars and the stores, the ox wagons parked.</p>
<p><b>The Hall of Justice</b> (<i>basilica</i>): after the Basilicas Aemilia and Julia, Pompeii's basilica and Vitruvius's at Fano:
a long hall, the nave between aisles on columns, a clerestory over the aisles' roofs, a portico on the forum side, the tribunal in
an apse opposite it; raised stage by stage from its podium to its walls and columns, its roof, its tribunal.</p>
<h3>Controls</h3>
<ul>
<li>Shift+W: this scene. L: the level of detail. V: close on the next item (orbit), and back. 1 to 4: day, golden hour,
night, winter. N: snow; T: rain. M, G, Z: the game's zooms; O: orbit; Q / E: turn the view.</li>
</ul>`;

/** A sim building for an item, and its camp (a crew on the site) if it has one. */
function simBuilding(it, id) {
  const def = BUILDINGS[it.type];
  const b = { id, type: it.type, x: it.x, y: it.y, size: def.size, turn: 0, efficiency: it.shut ? 0.1 : 1, def, walkers: [] };
  if (it.type === 'basilica') {
    const t = MONUMENT_TYPES.basilica;
    const stage = Math.floor(it.q / 4);
    const st = t.stages[stage];
    const share = (it.q % 4) / 4 + 0.05;
    const got = st ? Object.fromEntries(Object.entries(st.goods).map(([g, n]) => [g, Math.round(n * Math.min(1, share + 0.45))])) : {};
    b.mon = { stage, work: st ? st.work * share : 0, got, way: {}, paid: true, halted: !!it.halted, store: 0, sacked: !!it.sacked, setbackRaid: it.struck ? 'raid:1' : undefined };
    if (it.q >= 16) b.efficiency = it.shut ? 0.2 : 1;
  } else {
    b.camp = { larder: 100, water: it.water !== false, fed: it.fed !== false, factor: 1, shortSince: -1, crew: { state: it.out ? 'site' : 'home', since: 0, site: 0 } };
  }
  return b;
}

function ground(ox, oz) {
  const g = new Group();
  const earth = new PlaneGeometry(MAP_W * TILE * 1.5, (MAP_H + 14) * TILE * 1.5, 1, 1).rotateX(-Math.PI / 2).translate(MAP_W * TILE / 2 - ox, 0, (MAP_H + 8) * TILE / 2 - oz);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  for (const y of [5.5, 11.5, 17.5, 21]) {
    const p = new PlaneGeometry(MAP_W * TILE, 2.0, 1, 1).rotateX(-Math.PI / 2).translate(MAP_W * TILE / 2 - ox, 0.004, y * TILE - oz - 1.2);
    g.add(new Mesh(tintGeometry(boxUV(p)), material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 })));
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

/** Build the scene (the lab.js commerce scenes' shape: id, group, labels, setLod...). */
export function buildMonumentsScene() {
  const group = new Group();
  group.name = 'monuments-scene';
  const ox = (MAP_W / 2) * TILE;
  const oz = (MAP_H / 2) * TILE;
  group.add(ground(ox, oz));
  const holder = new Group();
  holder.scale.setScalar(TILE);
  holder.position.set(-ox, 0, -oz);
  group.add(holder);
  const built = new Group();
  holder.add(built);
  const people = new PeopleBatch(holder);
  // The showcase of the site's pieces, in metres along a row below the map.
  const show = new Group();
  group.add(show);
  const showPeople = new PeopleBatch(group);
  const pieceAt = (i) => [-ox + 10 + i * 15, (MAP_H + 4) * TILE - oz];
  const pileAt = (i) => [-ox + 6 + i * 12, (MAP_H + 9.5) * TILE - oz];
  let lod = 0;
  // The made-up game: the items as buildings, a camp for each site the crew works, the raid now on.
  const buildings = new Map();
  const game = { buildings, walkers: new Map(), units: new Map(), city: {}, time: { totalTicks: 1, totalDays: 400 }, military: { active: { id: 1 } }, map: { w: MAP_W, h: MAP_H } };
  let id = 1;
  const placed = ITEMS.map((it) => {
    const b = simBuilding(it, id++);
    buildings.set(b.id, b);
    if (it.type === 'basilica' && it.q < 16 && !it.halted && !it.struck) buildings.set(id, { id: id++, camp: { crew: { state: 'site', since: 0, site: b.id } } });
    return { b, it };
  });
  const kits = new Map();
  const kitOf = (key) => {
    let k = kits.get(key);
    if (!k) {
      k = modelFor(key).build(key, lod);
      k.updateMatrixWorld(true);
      kits.set(key, k);
    }
    return k;
  };
  /** A copy of a kit's meshes (shared geometry) at matrix `mat`, the parts its state shows. */
  const place = (key, mat, state, into = built) => {
    const h = new Group();
    h.matrixAutoUpdate = false;
    h.matrix.copy(mat);
    kitOf(key).traverse((mesh) => {
      if (!mesh.isMesh || !partShows(mesh.userData.when, state, false)) return;
      const c = new Mesh(mesh.geometry, mesh.material);
      c.castShadow = mesh.castShadow;
      c.receiveShadow = true;
      c.matrixAutoUpdate = false;
      c.matrix.copy(mesh.matrixWorld);
      h.add(c);
    });
    into.add(h);
    return h;
  };
  const matOf = (b) => modelMatrix(b.x, b.y, b.size, b.turn || 0, 0);
  const _l = new Matrix4();
  /** The moving copies (site:wheel, site:falls, site:load), refilled from the variant each frame. */
  let moving = [];
  const showMoving = [];
  const isMoving = (key) => /^site:(wheel|falls|load)/.test(key);
  function build() {
    built.clear();
    show.clear();
    for (const g of kits.values()) g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    kits.clear();
    moving = [];
    people.begin(lod);
    for (const p of placed) {
      const v = MODELS[p.b.type].variant(p.b, { snow: 0 }, { game, clock: 0 });
      const m = matOf(p.b);
      place(v.key, m, v.state);
      for (const e of v.more || []) {
        for (let j = 0; j < e.n; j++) {
          const h = place(e.key, m.clone().multiply(_l.fromArray(e.mats, j * 16)), e.state || 'always');
          if (isMoving(e.key)) moving.push({ p, key: e.key, j, h, m });
        }
      }
      if (v.actors) people.add(v.actors, m, p.b.id);
    }
    people.end();
    // The pieces alone, each its own group; the piles of every good.
    showPeople.begin(lod);
    showMoving.length = 0;
    PIECES.forEach((pc, i) => {
      const [x, z] = pieceAt(i);
      const g = siteGroup(pc.site, lod);
      g.position.set(x, 0, z);
      show.add(g);
      for (const e of siteMotion(pc.site, 0)) {
        for (let j = 0; j < e.n; j++) {
          const k = buildSitePart(e.key, lod);
          k.matrixAutoUpdate = false;
          show.add(k);
          showMoving.push({ pc, key: e.key, j, k, x, z });
        }
      }
      const a = siteActors({ ...pc.site, crew: pc.crew || [] });
      if (a.length) showPeople.add(cast(a), new Matrix4().makeTranslation(x, 0, z), 900 + i);
    });
    PILE_GOODS.forEach((good, i) => {
      const [x, z] = pileAt(i);
      const g = buildSitePart(`site:pile:${good}:3`, lod);
      g.position.set(x, 0, z);
      show.add(g);
    });
    showPeople.end();
  }
  let ready = false;
  const ensure = () => {
    if (!ready) {
      ready = true;
      build();
    }
  };
  const _m = new Matrix4();
  const life = (t) => {
    ensure();
    game.time.totalTicks = 1 + Math.floor(t * 10);
    for (const mv of moving) {
      const v = MODELS[mv.p.b.type].variant(mv.p.b, { snow: 0 }, { game, clock: t });
      const e = (v.more || []).find((x) => x.key === mv.key);
      if (!e) continue;
      mv.h.matrix.copy(mv.m).multiply(_l.fromArray(e.mats, mv.j * 16));
    }
    for (const mv of showMoving) {
      const e = siteMotion(mv.pc.site, t).find((x) => x.key === mv.key);
      if (!e) continue;
      _m.makeTranslation(mv.x, 0, mv.z).multiply(_l.fromArray(e.mats, mv.j * 16));
      mv.k.matrix.copy(_m);
    }
  };
  const where = (i) => {
    if (i < ITEMS.length) {
      const it = ITEMS[i];
      const S = BUILDINGS[it.type].size;
      return { x: (it.x + S / 2) * TILE - ox, z: (it.y + S / 2) * TILE - oz };
    }
    const k = i - ITEMS.length;
    if (k < PIECES.length) {
      const [x, z] = pieceAt(k);
      return { x, z };
    }
    const [x, z] = pileAt(k - PIECES.length);
    return { x, z };
  };
  const labels = [
    ...ITEMS.map((it, i) => ({ name: it.name, note: it.note, ...where(i), y: it.type === 'basilica' ? 15 : 5 })),
    ...PIECES.map((pc, i) => ({ name: pc.name, note: pc.note, x: pieceAt(i)[0] - 4, z: pieceAt(i)[1] - 4, y: 7 })),
    ...PILE_GOODS.map((g, i) => ({ name: g[0].toUpperCase() + g.slice(1), note: 'three loads on site', x: pileAt(i)[0] - 1.5, z: pileAt(i)[1] - 1, y: 1.6 })),
  ];
  let close = -1;
  const all = ITEMS.length + PIECES.length + PILE_GOODS.length;
  return {
    id: 'monuments',
    title: 'Monuments',
    key: 'Shift+W',
    info: INFO,
    group,
    labels,
    fade: [0, 10, 120, 140],
    lamp: [where(9).x + 2.2, Y_LAMP, where(9).z + 5.6],
    shadowBox: 90,
    noAO: [people.group, showPeople.group],
    people,
    life,
    get lod() { return lod; },
    setLod(n) {
      if (n === lod) return;
      lod = n;
      if (ready) build();
    },
    onKey(k, api) {
      if (k !== 'v') return false;
      close = close + 1 >= all ? -1 : close + 1;
      if (api) api.closeUp(close, { dist: 30, el: 32, ty: 3, az: 35 });
      return true;
    },
    where,
    get figures() {
      return Array.from({ length: all }, (_, i) => ({ name: labels[i].name, ...where(i) }));
    },
    items: [...ITEMS.map((it) => ({ type: it.type, name: it.name, note: it.note })), ...PIECES.map((p) => ({ type: 'site', name: p.name, note: p.note })), ...PILE_GOODS.map((g) => ({ type: 'pile', name: g }))],
    setTurn() {},
    setWinter() { ensure(); },
    /** Each look's triangles at a level of detail (its kit and its `more` kits), by item. */
    triangles(l = lod) {
      return placed.map(({ b, it }) => {
        const v = MODELS[b.type].variant(b, { snow: 0 }, { game, clock: 0 });
        let n = 0;
        const count = (key, state, times) => modelFor(key).build(key, l).traverse((o) => {
          if (o.isMesh && partShows(o.userData.when, state, false)) n += times * (o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3);
        });
        count(v.key, v.state, 1);
        for (const e of v.more || []) count(e.key, e.state || 'always', e.n);
        return { name: it.name, note: it.note, key: v.key, triangles: Math.round(n), people: v.actors ? v.actors.actors.length : 0 };
      });
    },
    stats: () => ({ people: { ...people.stats } }),
  };
}

/** The lab's torch beside the finished basilica's porch lantern. */
const Y_LAMP = 2.9;
