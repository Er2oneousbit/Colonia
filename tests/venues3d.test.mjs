/**
 * venues3d.test.mjs - the 3D theatre, amphitheatre, Great Arena and hippodrome (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the five types have models; a build ghost shows each staffed and
 *     empty, a hippodrome's ghost section by section
 *   - the state from the sim's fields: unstaffed, idle, a show on; a
 *     hippodrome's sections take the main's; what is on (the acts)
 *   - every look (its kit, its crowd, what is on) fits its footprint at
 *     every view turn and level of detail, on the ground; each level lighter
 *   - the hippodrome's sections meet at their seams: the stands' section is
 *     the same on both sides of each edge
 *   - the people stay on their venue's footprint at every view turn
 *   - the crowd: none without a show, as many as the city fills, its groups
 *     lighter far out
 *   - the shows' figures: placed on the venue's own tiles at every turn of
 *     the building, the race on the track as the 2D race lays it, the
 *     chariots apart, the laps counted 0 to 7, every clock the game's
 *   - the lamps light only while a show is on
 *   - the shows' looks (a racer's quadriga, a venator, a lion) and the
 *     masks build
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Matrix4, Vector3 } from 'three';
import { MODELS, hasModel, modelMatrix, modelLamps, modelFor, TILE_M } from '../src/render3d/models.js';
import { VENUE_TYPES, VENUE_MODELS, venueState, venueActs, venueLook, crowdMore, venueFill, sectionOf, circusLaps } from '../src/render3d/models/venues.js';
import { venueShowList, localToMap, trackToMap, chariotAt, lapsNow, RACE, SHOW_TPS } from '../src/render3d/models/venueShow.js';
import { buildCircus } from '../src/render3d/models/circus.js';
import { actorBounds } from '../src/render3d/people/actors.js';
import { buildPiece } from '../src/render3d/people/pieces.js';
import { unitLook } from '../src/render3d/units/look.js';
import { buildUnitPiece } from '../src/render3d/units/pieces.js';
import { raceSpot } from '../src/render/renderer.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { CONFIG } from '../src/config.js';

const ALL = { theater: 20, amphitheater: 20, colosseum: 20, hippodrome: 20 };
const NONE = { theater: 0, amphitheater: 0, colosseum: 0, hippodrome: 0 };
const SIZE = (type) => BUILDINGS[type].size;
const tris = (g) => {
  let n = 0;
  g.traverse((o) => { if (o.isMesh && o.visible) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
  return n;
};
/** A venue and the game it stands in (a hippodrome with its two parts). */
function scene(type, { shows = ALL, efficiency = 1, turn = 0, pop = 3000 } = {}) {
  const def = BUILDINGS[type];
  const b = { id: 7, type, x: 20, y: 9, size: def.size, turn, efficiency, shows: { ...shows }, def };
  const buildings = new Map([[b.id, b]]);
  if (def.span > 1) {
    b.parts = [];
    for (let k = 1; k < 3; k++) {
      const p = { id: 7 + k, type: `${type}_part`, x: 20, y: 9, size: def.size, turn, efficiency: 0, shows: null, main: b.id, section: k, def: BUILDINGS[`${type}_part`] };
      buildings.set(p.id, p);
      b.parts.push(p.id);
    }
  }
  const game = { buildings, city: { population: pop }, time: { totalTicks: 40 }, map: { w: 64, h: 64 } };
  return { b, game };
}

test('venues3d: the venues have models; a build ghost shows each staffed and empty, a hippodrome section by section', () => {
  assert.deepEqual([...VENUE_TYPES].sort(), ['amphitheater', 'colosseum', 'hippodrome', 'hippodrome_part', 'theater']);
  for (const t of VENUE_TYPES) {
    assert.ok(hasModel(t), t);
    const v = MODELS[t].variant({ id: null, type: t, x: 0, y: 0, size: SIZE(t), efficiency: 1, section: t === 'hippodrome_part' ? 2 : 0 }, { snow: 0 }, { game: null });
    assert.equal(v.state, 'out', t);
    assert.ok(!(v.more || []).some((e) => e.key.startsWith('crowd:')), `${t}: a ghost has no crowd`);
  }
  // (The plan's parts carry their place in the row: renderer.js placeGhostModels passes it as the ghost's section.)
  assert.equal(MODELS.hippodrome_part.variant({ id: null, type: 'hippodrome_part', size: 5, efficiency: 1, section: 2 }, {}, {}).key, 'hippodrome:s2');
  assert.equal(MODELS.hippodrome.variant({ id: null, type: 'hippodrome', size: 5, efficiency: 1 }, {}, {}).key, 'hippodrome:s0');
});

test('venues3d: the state from the sim: shut unstaffed, out idle, open with a show; a section is its hippodrome\'s', () => {
  for (const type of ['theater', 'amphitheater', 'colosseum', 'hippodrome']) {
    assert.equal(venueState(scene(type, { efficiency: 0 }).b), 'shut', type);
    assert.equal(venueState(scene(type, { shows: NONE }).b), 'out', type);
    assert.equal(venueState(scene(type).b), 'open', type);
  }
  const { b, game } = scene('hippodrome');
  const part = game.buildings.get(b.parts[1]);
  assert.equal(sectionOf(part), 2);
  assert.equal(sectionOf(b), 0);
  assert.equal(venueState(part, game), 'open', 'a part (unstaffed itself) shows its main\'s races');
  b.efficiency = 0;
  assert.equal(venueState(part, game), 'shut');
  assert.deepEqual(venueActs(scene('amphitheater', { shows: { ...NONE, theater: 3, amphitheater: 1 } }).b), { play: true, bouts: true, hunt: false, races: false });
  // A play booked at an amphitheatre brings its stage of boards; bouts alone do not.
  const withPlay = MODELS.amphitheater.variant(scene('amphitheater', { shows: { ...NONE, theater: 3, amphitheater: 1 } }).b, {}, { game: null });
  const noPlay = MODELS.amphitheater.variant(scene('amphitheater', { shows: { ...NONE, amphitheater: 1 } }).b, {}, { game: null });
  assert.ok(withPlay.more.some((e) => e.key === 'amphitheater:stage') && !noPlay.more.some((e) => e.key === 'amphitheater:stage'));
});

test('venues3d: every look fits its footprint at every view turn and level of detail, on the ground; each level lighter', () => {
  const e = 1e-6;
  const looks = [['theater', 0], ['amphitheater', 0], ['colosseum', 0], ['hippodrome', 0], ['hippodrome', 1], ['hippodrome', 2]];
  for (const [type, section] of looks) {
    const S = SIZE(type);
    const counts = [];
    for (let lod = 0; lod < 3; lod++) {
      for (const state of ['open', 'out', 'shut']) {
        const g = venueLook(type, lod, { state, section });
        g.updateMatrixWorld(true);
        const local = new Box3().setFromObject(g);
        if (state === 'open') counts[lod] = tris(g);
        for (let T = 0; T < 4; T++) {
          const b = local.clone().applyMatrix4(modelMatrix(20, 9, S, T, 0));
          assert.ok(b.min.x >= 20 - e && b.max.x <= 20 + S + e && b.min.z >= 9 - e && b.max.z <= 9 + S + e, `${type}:${section} ${state} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
          assert.ok(b.min.y > -0.003 && b.max.y < 2, `${type}:${section} ${state} lod ${lod}: from ${b.min.y} to ${b.max.y} tiles high`);
        }
      }
    }
    assert.ok(counts[0] > counts[1] && counts[1] > counts[2], `${type}:${section}: ${counts}`);
  }
});

test('venues3d: the hippodrome\'s sections meet: the stands and the sand run on across every seam', () => {
  for (let lod = 0; lod < 3; lod++) {
    const edge = (k, x) => {
      const out = new Set();
      for (const m of buildCircus(k, { lod }).meshes) {
        if (m.name !== 'seats' && m.name !== 'sand') continue;
        const P = m.geometry.attributes.position;
        for (let i = 0; i < P.count; i++) if (Math.abs(P.getX(i) - x) < 1e-4) out.add(`${m.name}:${P.getY(i).toFixed(3)}:${P.getZ(i).toFixed(3)}`);
      }
      return out;
    };
    for (const k of [0, 1]) {
      const a = edge(k, 10);
      const b = edge(k + 1, -10);
      assert.ok(a.size > 20, `section ${k} lod ${lod}: its edge`);
      for (const v of a) if (v.startsWith('seats')) assert.ok(b.has(v), `section ${k}|${k + 1} lod ${lod}: ${v} has no match across the seam`);
    }
  }
});

test('venues3d: the people stay on their venue\'s footprint at every view turn', () => {
  const m = new Matrix4();
  const p = new Vector3();
  for (const type of ['theater', 'amphitheater', 'colosseum', 'hippodrome', 'hippodrome_part']) {
    for (const shows of [ALL, NONE]) {
      const { b, game } = scene(type === 'hippodrome_part' ? 'hippodrome' : type, { shows });
      const sections = type === 'hippodrome_part' ? b.parts.map((id) => game.buildings.get(id)) : [b];
      for (const sb of sections) {
        const v = MODELS[sb.type].variant(sb, { snow: 0 }, { game });
        const S = sb.size;
        for (let T = 0; T < 4; T++) {
          modelMatrix(0, 0, S, T, 0, m);
          for (const act of v.actors.actors) {
            for (const c of actorBounds(act, 0.3)) {
              for (const [dx, dz] of [[c.r, 0], [-c.r, 0], [0, c.r], [0, -c.r]]) {
                p.set(c.x + dx, 0, c.z + dz).applyMatrix4(m);
                assert.ok(p.x >= -1e-6 && p.x <= S + 1e-6 && p.z >= -1e-6 && p.z <= S + 1e-6, `${sb.type} turn ${T}: an actor at ${c.x.toFixed(2)}, ${c.z.toFixed(2)} off the footprint`);
              }
            }
          }
        }
      }
    }
  }
});

test('venues3d: the crowd: none without a show, as many as the city fills, a fifth at a time; far out a group is lighter', () => {
  const groups = (list) => list.filter((e) => e.key.startsWith('crowd:')).reduce((s, e) => s + e.n, 0);
  for (const type of ['theater', 'amphitheater', 'colosseum']) {
    assert.equal(groups(MODELS[type].variant(scene(type, { shows: NONE }).b, {}, { game: null }).more), 0, `${type}: no show, no crowd`);
    const full = groups(crowdMore(type, 0, 5, 0));
    const fifth = groups(crowdMore(type, 0, 1, 0));
    assert.ok(full > 10 && fifth > 0 && fifth < full * 0.45, `${type}: ${fifth} of ${full}`);
  }
  // The city fills the seats of its working venues: 400 people a theatre.
  const { game } = scene('theater', { pop: 200 });
  game.time.totalTicks = 1;
  assert.equal(venueFill(game, 'theater'), 3);
  game.city.population = 5000;
  game.time.totalTicks = 2;
  assert.equal(venueFill(game, 'theater'), 5);
  const sit = (lod) => tris(modelFor('crowd:sit:toga:0').build('crowd:sit:toga:0', lod));
  assert.ok(sit(0) > sit(1) && sit(1) > sit(2) * 3 && sit(2) < 150, `${sit(0)} / ${sit(1)} / ${sit(2)}`);
});

test('venues3d: the shows\' figures stand on the venue\'s own tiles at every turn of the building, by the game\'s clock', () => {
  for (const type of ['amphitheater', 'colosseum']) {
    for (let turn = 0; turn < 4; turn++) {
      const { b, game } = scene(type, { turn });
      const ids = new Set();
      for (const tick of [0, 30, 60, 90, 120, 150]) {
        const list = venueShowList(b, game, tick);
        assert.ok(list.length >= 2, `${type}: its fighters`);
        for (const f of list) {
          ids.add(f.u.id);
          assert.ok(f.u.id < 0, 'a made-up unit has a negative id');
          const m = 0.25;
          assert.ok(f.at.fx > b.x + m && f.at.fx < b.x + b.size - m && f.at.fy > b.y + m && f.at.fy < b.y + b.size - m, `${type} turn ${turn} tick ${tick}: ${f.u.type} at ${f.at.fx}, ${f.at.fy}`);
        }
        // The same tick, the same places (no randomness; paused, a still picture).
        assert.deepEqual(venueShowList(b, game, tick).map((f) => [f.at.fx, f.at.fy]), list.map((f) => [f.at.fx, f.at.fy]));
      }
      assert.equal(ids.size, type === 'colosseum' ? 6 : 2, `${type}: the same figures throughout`);
    }
    assert.equal(venueShowList(scene(type, { shows: NONE }).b, null, 10).length, 0, `${type}: no show, no figures`);
    assert.equal(venueShowList(scene(type, { efficiency: 0 }).b, null, 10).length, 0, `${type}: unstaffed, no figures`);
  }
  // A venue's own metres to the map, as the model stands (its middle at the footprint's middle).
  const { b } = scene('colosseum', { turn: 1 });
  assert.deepEqual(localToMap(b, 0, 0), [b.x + 2.5, b.y + 2.5]);
});

test('venues3d: the race runs on the track as the 2D race lays it, at every turn; the chariots never run into each other', () => {
  for (let turn = 0; turn < 4; turn++) {
    const { b, game } = scene('hippodrome', { turn });
    for (const [U, v] of [[0.5, 0.5], [7.5, 2.5], [14.2, 4.1]]) assert.deepEqual(trackToMap(b, U, v), raceSpot(b, U, v).slice(0, 2), `turn ${turn}`);
    for (const tick of [0, 100, 777]) {
      const list = venueShowList(b, game, tick);
      assert.equal(list.length, 4, 'four chariots');
      const part = game.buildings.get(b.parts[0]);
      assert.equal(venueShowList(part, game, tick).length, 0, 'the race is the main section\'s');
      void list;
    }
  }
  for (let tick = 0; tick < 4000; tick += 7) {
    const cs = [0, 1, 2, 3].map((k) => chariotAt(k, tick));
    for (const c of cs) {
      // On the sand, clear of the spina (in tiles: the spina 0.7 m, the track 6 m from the middle line).
      const off = Math.hypot(Math.max(0, RACE.U0 - c.U, c.U - RACE.U1), c.v - RACE.mid);
      assert.ok(off > 0.7 / TILE_M + 0.28 && off < 6 / TILE_M - 0.28, `tick ${tick}: off the middle line ${off}`);
    }
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      assert.ok(Math.hypot(cs[i].U - cs[j].U, cs[i].v - cs[j].v) > 0.5, `tick ${tick}: chariots ${i} and ${j} collide`);
    }
    const laps = lapsNow(tick);
    assert.ok(laps >= 0 && laps <= RACE.laps);
  }
  assert.equal(SHOW_TPS, CONFIG.TICKS_PER_SECOND);
  // The eggs taken down and the dolphins turned, one a lap.
  const eggs = (laps) => circusLaps(laps).filter((e) => e.key === 'hippodrome:egg').reduce((s, e) => s + e.n, 0);
  assert.equal(eggs(0), 7);
  assert.equal(eggs(3), 4);
  assert.equal(eggs(7), 0);
});

test('venues3d: the lamps light only while a show is on', () => {
  for (const type of ['theater', 'amphitheater', 'colosseum', 'hippodrome']) {
    const { b, game } = scene(type);
    MODELS[type].variant(b, {}, { game });
    assert.ok(modelLamps(b, 0).length > 0 || type === 'hippodrome', `${type}: lit`);
    b.shows = { ...NONE };
    MODELS[type].variant(b, {}, { game });
    assert.equal(modelLamps(b, 0).length, 0, `${type}: dark`);
  }
});

test('venues3d: the shows\' looks build: a quadriga, a venator, a lion, the actors\' masks, the referee\'s staff', () => {
  const racer = unitLook({ id: -5, type: 'chariot', look: 'racer', faction: 2 }, {});
  assert.equal(racer.figures.filter((f) => f.species === 'horse').length, 4, 'four horses');
  assert.ok(racer.figures.some((f) => f.rigid === 'cart:chariot'));
  const lion = unitLook({ id: -6, type: 'wolf', look: 'lion' }, {});
  assert.equal(lion.figures[0].quad, 'quad:wolf:mane');
  const plain = buildUnitPiece('quad:wolf', 1);
  const maned = buildUnitPiece('quad:wolf:mane', 1);
  assert.ok(maned.index.count > plain.index.count, 'the mane');
  const v = unitLook({ id: -7, type: 'gladiator', look: 'venator' }, {});
  assert.equal(v.figures.length, 1);
  for (const kit of [0, 1, 2]) assert.ok(unitLook({ id: -8, type: 'gladiator', kit }, {}).key.endsWith(`|${kit}`), 'a gladiator\'s kit in his look\'s key');
  for (const k of ['prop:persona:L', 'prop:personaComic:L', 'prop:rudis:R']) for (let lod = 0; lod < 3; lod++) assert.ok(buildPiece(k, lod).index.count > 0, k);
  void VENUE_MODELS;
});
