/**
 * worksite3d.test.mjs - the monuments' building sites in 3D (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - siteParts: every field of a site makes its geometry in its materials,
 *     an empty or missing site makes none, each level lighter than the one
 *     before; fresh copies each call (a caller may merge and free them) of
 *     a cache kept by the site's content and level
 *   - a site's pieces stand where they are told, turned by ry, on the ground
 *   - siteMotion: a working treadwheel's wheel turns, its load rises on its
 *     falls from the ground to under the jib, the cycle runs round with no
 *     jump; still cranes are siteParts' whole
 *   - the crew a working crane needs: the treader in the wheel on its floor,
 *     his hands on the spokes; the winder at the shear legs' crank
 *   - siteView: the sim's stage, its rise, the goods on site, the crew, a
 *     halt, a raid's setback, a finished monument sacked or open
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Matrix4, Vector3 } from 'three';
import {
  siteParts, siteGroup, siteKey, siteMotion, siteActors, craneCrew, siteView, buildSitePart, addSite,
  TREAD, TREAD_SPEED, craneReach, liftCycle, loadTop, shearWindlass, PILE_MAX, RISE_STEPS,
} from '../src/render3d/models/worksite.js';
import { TaggedParts } from '../src/render3d/models/masonry.js';
import { modelFor } from '../src/render3d/models.js';
import { poseAt, WINDLASS, WALK_SPEED } from '../src/render3d/people/clips.js';
import { cast } from '../src/render3d/people/actors.js';
import { MONUMENT_TYPES, CAMP } from '../src/data/monuments.js';

const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const total = (parts) => parts.reduce((n, e) => n + tris(e.g), 0);

/** A site with one of everything. */
const FULL = Object.freeze({
  scaffolds: [{ x: 0, z: 0, w: 8, d: 3, h: 6, ry: 0 }, { x: 0, z: 6, w: 4, d: 4, h: 4.5, ry: 0.3, fallen: true }],
  cranes: [{ x: -6, z: -6, ry: 0, h: 10, kind: 'treadwheel' }, { x: 6, z: -6, ry: 1, h: 10, kind: 'treadwheel', work: true, load: 'drum' }, { x: 6, z: 6, h: 5, kind: 'shear', work: true }],
  centering: [{ x: 0, z: -3, ry: 0, span: 4, rise: 2, depth: 2, y: 3 }, { x: 0, z: 0, dome: 6, y: 2, lag: 0.6 }],
  piles: ['marble', 'timber', 'clay', 'iron', 'stone'].map((good, i) => ({ x: -8 + i * 4, z: 8, ry: 0, good, n: 4 })),
  mortar: [{ x: 3, z: 3, ry: 0 }],
  rubble: [{ x: -3, z: 3, w: 3, d: 2 }],
  crew: [{ body: 'm', clip: 'idle', at: [0, 0, 0] }],
});

test('worksite3d: every field of a site makes its geometry; an empty site makes none', () => {
  assert.deepEqual(siteParts({}, 0), []);
  assert.deepEqual(siteParts(null, 1), []);
  assert.deepEqual(siteParts({ crew: FULL.crew }, 0), [], 'the crew is actors, not geometry');
  const one = {
    scaffolds: { scaffolds: [FULL.scaffolds[0]] }, fallen: { scaffolds: [FULL.scaffolds[1]] },
    treadwheel: { cranes: [FULL.cranes[0]] }, working: { cranes: [FULL.cranes[1]] }, shear: { cranes: [FULL.cranes[2]] },
    arch: { centering: [FULL.centering[0]] }, dome: { centering: [FULL.centering[1]] }, domeBare: { centering: [{ x: 0, z: 0, dome: 4, lag: 0 }] },
    mortar: { mortar: FULL.mortar }, rubble: { rubble: FULL.rubble },
    ...Object.fromEntries(FULL.piles.map((p) => [`pile ${p.good}`, { piles: [p] }])),
  };
  for (const [name, site] of Object.entries(one)) {
    for (let lod = 0; lod < 3; lod++) {
      const parts = siteParts(site, lod);
      assert.ok(parts.length > 0 && total(parts) > 0, `${name} lod ${lod}`);
      for (const e of parts) {
        assert.ok(e.g.isBufferGeometry && e.material.isMaterial && typeof e.name === 'string' && e.name.startsWith('site-') && typeof e.cast === 'boolean', name);
        for (const a of ['position', 'normal', 'uv', 'color']) assert.ok(e.g.attributes[a], `${name}: ${a}`);
      }
      // One part a material (one draw call each in the stage's kit).
      assert.equal(new Set(parts.map((e) => e.material)).size, parts.length, name);
    }
  }
  // A pile of nothing, or of more loads than a pile shows.
  assert.deepEqual(siteParts({ piles: [{ x: 0, z: 0, good: 'marble', n: 0 }] }, 0), []);
  assert.equal(total(siteParts({ piles: [{ x: 0, z: 0, good: 'clay', n: 40 }] }, 1)), total(siteParts({ piles: [{ x: 0, z: 0, good: 'clay', n: PILE_MAX }] }, 1)));
});

test('worksite3d: each level of detail is lighter than the one before, within budget', () => {
  const t = [0, 1, 2].map((l) => total(siteParts(FULL, l)));
  assert.ok(t[0] > t[1] && t[1] > t[2], `${t}`);
  assert.ok(t[0] < 40000 && t[1] < 16000 && t[2] < 7000, `${t}`);
  for (const key of ['site:wheel', 'site:load:marble', 'site:load:drum', 'site:load:timber', 'site:falls']) {
    const n = [0, 1, 2].map((l) => {
      let k = 0;
      buildSitePart(key, l).traverse((o) => { if (o.isMesh) k += tris(o.geometry); });
      return k;
    });
    assert.ok(n[0] >= n[1] && n[1] >= n[2] && n[2] > 0, `${key}: ${n}`);
    assert.ok(n[0] < 2000, `${key}: ${n}`);
    // The model pass finds it by its key's first word.
    assert.equal(modelFor(key).build, buildSitePart);
  }
});

test('worksite3d: fresh copies of a cache kept by the site\'s content and level', () => {
  const site = { scaffolds: [{ x: 1, z: 2, w: 5, d: 3, h: 4.5, ry: 0.2 }], piles: [{ x: -3, z: 0, good: 'timber', n: 2 }] };
  const a = siteParts(site, 1);
  // A copy each call: freeing one leaves the next whole.
  for (const e of a) e.g.dispose();
  const b = siteParts(site, 1);
  assert.equal(a.length, b.length);
  a.forEach((e, i) => {
    assert.notEqual(e.g, b[i].g);
    assert.equal(e.material, b[i].material);
    assert.deepEqual(Array.from(e.g.attributes.position.array), Array.from(b[i].g.attributes.position.array));
  });
  // Another object of the same content is the same cache entry; the crew is no part of the key.
  assert.equal(siteKey({ ...site, crew: [1, 2] }, 1), siteKey(JSON.parse(JSON.stringify(site)), 1));
  assert.notEqual(siteKey(site, 1), siteKey(site, 2));
  assert.notEqual(siteKey(site, 1), siteKey({ ...site, piles: [{ ...site.piles[0], n: 3 }] }, 1));
  const t0 = performance.now();
  for (let k = 0; k < 20; k++) siteParts(site, 1);
  assert.ok((performance.now() - t0) / 20 < 5, 'a cached site is copied, not built');
  // Merged into a model's own parts by name (TaggedParts), in a state.
  const p = addSite(new TaggedParts('stage'), site, 1, 'open').build();
  assert.ok(p.meshes.length === b.length && p.meshes.every((m) => m.userData.when === 'open'));
});

test('worksite3d: the pieces stand where they are told, turned by ry, on the ground', () => {
  const e = 0.12;
  for (const [x, z, ry] of [[0, 0, 0], [5, -3, Math.PI / 2], [-4, 7, 0.7]]) {
    // A scaffold's ring is the box it is given (its ladder a little out in front of it).
    const s = { x, z, w: 6, d: 2.4, h: 6, ry };
    const b = new Box3().setFromObject(siteGroup({ scaffolds: [s] }, 1));
    const reach = Math.hypot(3 + 0.5, 1.2 + 0.5);
    assert.ok(b.min.y > -0.01 && b.max.y < 6 + 1.1, JSON.stringify(b));
    assert.ok(Math.hypot(b.min.x - x, 0) <= reach + e && Math.hypot(b.max.x - x, 0) <= reach + e, `${x} ${ry}`);
    if (ry === 0) {
      assert.ok(b.min.x >= x - 3 - e && b.max.x <= x + 3 + e && b.min.z >= z - 1.2 - e && b.max.z <= z + 1.2 + 0.5, JSON.stringify(b));
    }
  }
  // A crane on the ground, its head h up and ahead of the wheel by its reach; turned a quarter, ahead is +x.
  for (const [ry, ax] of [[0, 'z'], [Math.PI / 2, 'x']]) {
    const b = new Box3().setFromObject(siteGroup({ cranes: [{ x: 0, z: 0, ry, h: 9, kind: 'treadwheel' }] }, 1));
    assert.ok(b.min.y > -0.01 && b.max.y > 9 && b.max.y < 9.6, JSON.stringify(b));
    assert.ok(b.max[ax] > craneReach(9) - 0.5, `${ax}: ${b.max[ax]}`);
  }
  // A dome's centering: a hemisphere of radius r sprung at y.
  const d = new Box3().setFromObject(siteGroup({ centering: [{ x: 0, z: 0, dome: 5, y: 2 }] }, 1));
  assert.ok(d.max.y < 2 + 5 + 0.2 && d.max.y > 2 + 4.5 && d.max.x < 5.2 && d.min.y > -0.01, JSON.stringify(d));
  // An arch's centering: its span across x, springing at y, the crown `rise` over it.
  const a = new Box3().setFromObject(siteGroup({ centering: [{ x: 0, z: 0, span: 4, rise: 2, depth: 1.5, y: 3 }] }, 1));
  assert.ok(Math.abs(a.max.y - 5) < 0.1 && a.max.x <= 2.1 && a.min.x >= -2.1 && a.max.z <= 0.8, JSON.stringify(a));
});

test('worksite3d: a working treadwheel turns its wheel and lifts its load round a cycle with no jump', () => {
  const site = { cranes: [{ x: 2, z: -1, ry: 0.4, h: 10, kind: 'treadwheel', work: true }, { x: -3, z: 2, h: 8, kind: 'treadwheel' }, { x: 0, z: 0, h: 5, kind: 'shear', work: true }] };
  const m = siteMotion(site, 0);
  // Only the working treadwheel moves: its wheel, its falls, its load.
  assert.deepEqual(m.map((e) => [e.key, e.n]), [['site:wheel', 1], ['site:falls', 1], ['site:load:marble', 1]]);
  assert.deepEqual(siteMotion({ cranes: [{ x: 0, z: 0, h: 9, kind: 'treadwheel' }] }, 3), []);
  assert.deepEqual(siteMotion({}, 3), []);
  // Refilled in place: the same entries next frame (nothing allocated a frame).
  assert.equal(siteMotion(site, 1)[0], m[0]);
  const c = site.cranes[0];
  const cyc = liftCycle(c.h);
  const loadAt = (t) => {
    const l = siteMotion(site, t).find((e) => e.key.startsWith('site:load'));
    const mat = new Matrix4().fromArray(l.mats, 0);
    const p = new Vector3().setFromMatrixPosition(mat);
    return { p, s: new Vector3().setFromMatrixScale(mat).x };
  };
  // Over the cycle: from the ground under the jib's head to near its top, and back to the ground.
  let lo = Infinity;
  let hi = -Infinity;
  let last = null;
  let biggest = 0;
  const dt = 0.05;
  for (let t = 0; t <= cyc.period * 1.01; t += dt) {
    const { p, s } = loadAt(t);
    if (s > 0.99) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
    // A move from one frame to the next: no jump while it is seen (shrunk away it may go back down).
    if (last && last.s > 0.5 && s > 0.5) biggest = Math.max(biggest, p.distanceTo(last.p));
    last = { p, s };
  }
  assert.ok(lo < 0.1 && hi > c.h - 3.2 && hi < c.h - 1.5, `${lo} to ${hi}`);
  assert.ok(biggest < 0.2, `a jump of ${biggest} m in ${dt} s`);
  // The load hangs under the head, the crane's reach ahead of its wheel (turned by ry).
  const { p } = loadAt(1);
  const want = new Vector3(Math.sin(c.ry) * craneReach(c.h), 0, Math.cos(c.ry) * craneReach(c.h)).add(new Vector3(c.x, 0, c.z));
  assert.ok(Math.hypot(p.x - want.x, p.z - want.z) < 0.1, `${p.x}, ${p.z}`);
  // The wheel turns at the treaders' pace: its floor moves under them as fast as their feet.
  const ang = (t) => {
    const w = new Matrix4().fromArray(siteMotion(site, t)[0].mats, 0);
    const v = new Vector3(0, 1, 0).transformDirection(w);
    return v;
  };
  const a0 = ang(0);
  const a1 = ang(0.5);
  const turned = Math.acos(Math.min(1, a0.dot(a1)));
  assert.ok(Math.abs(turned - (0.5 * TREAD.pace) / TREAD.floor) < 1e-3, `${turned}`);
  assert.ok(Math.abs(TREAD_SPEED * WALK_SPEED - TREAD.pace) < 1e-9);
  // The falls reach from the upper block down to the load's lower block.
  const f = new Matrix4().fromArray(siteMotion(site, 2).find((e) => e.key === 'site:falls').mats, 0);
  const top = new Vector3().setFromMatrixPosition(f);
  const len = new Vector3().setFromMatrixScale(f).y;
  const l = loadAt(2);
  assert.ok(Math.abs(top.y - len - (l.p.y + loadTop('marble'))) < 1e-3);
});

test('worksite3d: a working crane\'s men: the treader on the wheel\'s floor with his hands on its spokes, the winder at the crank', () => {
  assert.deepEqual(craneCrew({ x: 0, z: 0, h: 9, kind: 'treadwheel' }), [], 'a still crane needs nobody');
  const c = { x: 3, z: -2, ry: 0.5, h: 9, kind: 'treadwheel', work: true };
  const [treader, tag] = craneCrew(c, 5);
  assert.equal(treader.clip, 'tread');
  assert.equal(treader.speed, TREAD_SPEED);
  // His feet on the floor at the wheel's lowest point, in the middle of its width.
  assert.ok(Math.abs(treader.at[1] - (TREAD.axleY - TREAD.floor)) < 0.05);
  const local = new Vector3(treader.at[0] - c.x, 0, treader.at[2] - c.z).applyAxisAngle(new Vector3(0, 1, 0), -c.ry);
  assert.ok(Math.abs(local.x) < 0.01 && Math.abs(local.z) < 0.3, `${local.x}, ${local.z}`);
  assert.equal(treader.ry, c.ry);
  assert.equal(tag.clip, 'hold');
  // His hands reach the spokes at the wheel's sides (x 0.42 of his frame), inside the rims, at every phase,
  // and his head stays inside the wheel.
  for (let k = 0; k < 16; k++) {
    const p = poseAt('tread', k / 16);
    for (const s of ['L', 'R']) {
      const h = p.jointOf(`hand${s}`);
      assert.ok(Math.abs(Math.abs(h.x) - 0.42) < 0.06 && Math.abs(h.x) < TREAD.width / 2, `hand ${s} at ${h.x}`);
    }
    const head = p.jointOf('head');
    const r = Math.hypot(head.y + TREAD.axleY - TREAD.floor - TREAD.axleY, head.z);
    assert.ok(r < TREAD.floor - 0.2, `head ${r} from the axle`);
  }
  // The shear legs' winder, at the crank's end of the windlass.
  const [w] = craneCrew({ x: 0, z: 0, ry: 0, h: 5, kind: 'shear', work: true }, 3);
  const wl = shearWindlass(5);
  assert.equal(w.clip, 'windlass');
  assert.ok(Math.abs(w.at[0] - (wl.x1 + WINDLASS.x + 0.06)) < 1e-9 && Math.abs(w.at[2] - (wl.z + WINDLASS.ahead)) < 1e-9);
  // siteActors: the crew as given, then the cranes' men; packs as a cast.
  const site = { cranes: [c, { x: 0, z: 0, h: 5, kind: 'shear', work: true }], crew: [{ body: 'm', dress: ['tunic:short'], clip: 'hammer', at: [0, 0, 0], ry: 0, seed: 1 }] };
  const all = siteActors(site);
  assert.deepEqual(all.map((a) => a.clip), ['hammer', 'tread', 'hold', 'windlass']);
  assert.equal(cast(all).actors.length, 4);
  assert.deepEqual(siteActors(null), []);
});

/** A monument's building as the sim keeps it (sim/monumentEffects.js newSiteState), for siteView. */
function monument(type, mon, extra = {}) {
  return { id: 9, type, def: { mon: type, kind: 'monument' }, efficiency: 1, mon: { stage: 0, work: 0, got: {}, way: {}, paid: true, halted: false, store: 0, sacked: false, ...mon }, ...extra };
}
const gameWith = ({ crew = null, tick = 1, days = 100, raid = null } = {}) => ({
  time: { totalTicks: tick, totalDays: days },
  military: { active: raid },
  buildings: new Map(crew ? [[2, { id: 2, camp: { crew } }]] : []),
});

test('worksite3d: the stage view follows the sim: its stage, how far it has risen, the goods on site', () => {
  const t = MONUMENT_TYPES.basilica;
  // Nothing done: stage 0, step 0, no goods, nobody.
  let v = siteView(monument('basilica', {}), gameWith());
  assert.deepEqual([v.stage, v.stages, v.step, v.finished, v.crew, v.halted, v.struck], [0, t.stages.length, 0, false, false, false, false]);
  assert.deepEqual(v.stock, {});
  // Half the work of stage 1 done: step 2 of RISE_STEPS; its goods all in, half of them built in.
  const st = t.stages[1];
  const got = Object.fromEntries(Object.entries(st.goods).map(([g, n]) => [g, n]));
  v = siteView(monument('basilica', { stage: 1, work: st.work / 2, got }), gameWith());
  assert.equal(v.stage, 1);
  assert.equal(v.step, Math.floor(RISE_STEPS / 2));
  for (const [g, n] of Object.entries(st.goods)) assert.equal(v.stock[g], Math.min(PILE_MAX, Math.ceil(n / 2 / CAMP.load)), g);
  // The step never reaches a whole stage (the next stage starts the moment one is done).
  v = siteView(monument('basilica', { stage: 1, work: st.work * 0.999, got }), gameWith());
  assert.equal(v.step, RISE_STEPS - 1);
  // A load on its way is not on site yet.
  v = siteView(monument('basilica', { stage: 0, work: 0, got: {}, way: { clay: 400 } }), gameWith());
  assert.deepEqual(v.stock, {});
  // A ghost: stage 0, empty; no game: no crew, no raid.
  v = siteView({ id: null, type: 'basilica', def: { mon: 'basilica' } }, null);
  assert.equal(v.stage, 0);
  assert.equal(typeof v.sig, 'string');
});

test('worksite3d: the stage view: the crew on site, a halt, a raid\'s setback, finished, sacked or open', () => {
  const b = monument('basilica', { stage: 2, work: 10, got: { timber: 800 } });
  // A camp's crew in state 'site' at this very site; one at another site, or on the road, is not.
  assert.equal(siteView(b, gameWith({ crew: { state: 'site', since: 0, site: 9 } })).crew, true);
  assert.equal(siteView(b, gameWith({ crew: { state: 'site', since: 0, site: 8 } })).crew, false);
  assert.equal(siteView(b, gameWith({ crew: { state: 'out', since: 0, site: 9 } })).crew, false);
  // Halted: the crew goes home (and is shown gone at once), the cranes still.
  const h = { ...b, mon: { ...b.mon, halted: true } };
  const vh = siteView(h, gameWith({ crew: { state: 'site', since: 0, site: 9 } }));
  assert.equal(vh.halted, true);
  assert.equal(vh.crew, false);
  // Raiders set it back in the raid now on (sim/monuments.js raidKey); after it, the site stands again.
  const raid = { id: 4 };
  const s = { ...b, mon: { ...b.mon, setbackRaid: 'raid:4' } };
  assert.equal(siteView(s, gameWith({ raid })).struck, true);
  assert.equal(siteView(s, gameWith({ raid: null })).struck, false);
  // Finished: open while it works (staffed), shut without hands, sacked.
  const n = MONUMENT_TYPES.basilica.stages.length;
  const f = monument('basilica', { stage: n }, { efficiency: 1 });
  let v = siteView(f, gameWith());
  assert.deepEqual([v.finished, v.open, v.sacked, v.stage], [true, true, false, n]);
  v = siteView({ ...f, efficiency: 0.2 }, gameWith());
  assert.equal(v.open, false);
  v = siteView({ ...f, mon: { ...f.mon, sacked: true } }, gameWith());
  assert.deepEqual([v.sacked, v.open], [true, false]);
  // Each look its own signature.
  const sigs = new Set([b, h, s, f].map((x) => siteView(x, gameWith({ raid, crew: { state: 'site', since: 0, site: 9 } })).sig));
  assert.equal(sigs.size, 4);
});
