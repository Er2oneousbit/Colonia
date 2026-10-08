/**
 * ships3d.test.mjs - the ships and boats in 3D (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - every vessel the sim moves (a walker of kind 'ship', a unit with
 *     `naval`) has a design, every raiding people a craft, every partner's
 *     merchant a corbita or a coaster; every state a mode
 *   - every kit builds at every level of detail, each level lighter
 *   - a ship's rower: his sweep turns on his bench's thole (the port or
 *     the gunwale), its blade deep in the water through the drive and clear
 *     of it through the recovery, on every oared design
 *   - the motion: a ship faces the way it goes, turning the short way and
 *     eased (no jump), lies at its mooring, the sail full with the wind
 *     astern and shivering with it ahead
 *   - a moored ship sits off its quay (never inside the building's
 *     footprint) on every side, alongside or stern-to, the squadron side by
 *     side without touching
 *   - the pass: a ship handed over is placed where the sim puts it, facing
 *     its heading, its click spot along its hull, its lantern's place left
 *     for the night; its crew written once while the set stays
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Vector3, Group, Matrix4 } from 'three';
import { DESIGNS, KINDS, benches, extentOf } from '../src/render3d/ships/designs.js';
import { buildVesselPart, placesOf } from '../src/render3d/ships/hulls.js';
import { vesselKind, vesselMode, crewOf, isVessel, RAIDER_CRAFT, COASTER_PARTNERS } from '../src/render3d/ships/look.js';
import { ShipMotion, trimFor, yawOf, sinkPose, SINK_S, MOOR_S } from '../src/render3d/ships/motion.js';
import { alongside, sternTo, frontOf, MOOR_GAP } from '../src/render3d/ships/moorings.js';
import { ShipPass } from '../src/render3d/ships/pass.js';
import { kitOf } from '../src/render3d/kit.js';
import { MODEL_PARTS, modelFor } from '../src/render3d/models.js';
import { poseAt, ROW_SHIP, CLIP_INDEX } from '../src/render3d/people/clips.js';
import { BONE } from '../src/render3d/people/rig.js';
import { WALKER_TYPES } from '../src/data/walkers.js';
import { UNIT_TYPES, STATION_CAPACITY } from '../src/data/units.js';
import { PEOPLES } from '../src/data/peoples.js';
import { TRADE_PARTNERS } from '../src/data/scenarios.js';
import { HALF_W, HALF_H } from '../src/config.js';
import { GameMap } from '../src/world/map.js';

test('ships3d: every vessel the sim moves has a design; raiders by people, merchants by partner; every state a mode', () => {
  const walkers = Object.entries(WALKER_TYPES).filter(([, d]) => d.kind === 'ship').map(([type]) => type);
  const units = Object.entries(UNIT_TYPES).filter(([, d]) => d.naval).map(([type]) => type);
  assert.deepEqual(walkers.sort(), ['fishing_boat', 'ship']);
  assert.deepEqual(units.sort(), ['liburnian', 'raider_ship']);
  for (const type of walkers) assert.ok(DESIGNS[vesselKind({ kind: 'ship', type, partner: 'carthago' })], type);
  for (const type of units) assert.ok(DESIGNS[vesselKind({ type }, null)], type);
  for (const people of Object.keys(PEOPLES)) {
    const k = vesselKind({ type: 'raider_ship' }, people);
    assert.ok(DESIGNS[k], people);
    assert.equal(k, RAIDER_CRAFT[people] || 'lembos');
  }
  for (const partner of Object.keys(TRADE_PARTNERS)) {
    assert.equal(vesselKind({ kind: 'ship', type: 'ship', partner }), COASTER_PARTNERS.includes(partner) ? 'coaster' : 'corbita', partner);
  }
  assert.ok(!isVessel({ kind: 'roamer', type: 'prefect' }) && isVessel({ kind: 'ship', type: 'ship' }) && isVessel({ type: 'liburnian' }));
  // The modes: moored at its quay, under sail, fishing, rowing to fight, at anchor.
  const mode = (e, moving = true) => vesselMode(e, moving).mode;
  assert.equal(mode({ type: 'ship', state: 'docked' }), 'moored');
  assert.equal(mode({ type: 'ship', state: 'toDock' }), 'sail');
  assert.equal(mode({ type: 'fishing_boat', state: 'fishing' }), 'fishing');
  assert.ok(vesselMode({ type: 'fishing_boat', state: 'homeWithCatch' }, true).catch);
  for (const s of ['moored', 'spare']) assert.equal(mode({ type: 'fishing_boat', state: s }), 'moored');
  assert.equal(mode({ type: 'liburnian', state: 'berthed' }), 'moored');
  assert.equal(mode({ type: 'liburnian', state: 'training' }), 'moored');
  assert.equal(mode({ type: 'liburnian', state: 'engage' }), 'fight');
  assert.ok(!vesselMode({ type: 'liburnian', state: 'engage' }, true).sail, 'a liburnian fights under oars alone');
  assert.equal(mode({ type: 'liburnian', state: 'holding' }, false), 'anchor');
  assert.equal(mode({ type: 'raider_ship', state: 'offshore' }, false), 'anchor');
  assert.ok(vesselMode({ type: 'raider_ship', state: 'sail' }, true).row);
  // Every design's crew in every mode is made of known clips.
  for (const k of KINDS) {
    for (const m of [{ mode: 'sail', row: true, sail: true }, { mode: 'moored' }, { mode: 'fishing' }, { mode: 'fight', row: true }, { mode: 'anchor' }]) {
      for (const a of crewOf(k, m, { people: 'gauls' })) assert.ok(a.clip in CLIP_INDEX, `${k} ${m.mode}: ${a.clip}`);
    }
  }
});

test('ships3d: every kit builds at every level of detail, each level lighter', () => {
  assert.ok(MODEL_PARTS.vessel, 'the vessels are model parts');
  for (const k of KINDS) {
    const keys = [`vessel:${k}:hull`, `vessel:${k}:yard:0`, `vessel:${k}:sail:0`, `vessel:${k}:sail:0:3f6fb0`, `vessel:${k}:furl:0`];
    for (const key of keys) {
      const tris = [0, 1, 2].map((lod) => kitOf(modelFor(key).build(key, lod)).triangles);
      assert.ok(tris.every((t) => t > 0), `${key} ${tris}`);
      assert.ok(tris[0] >= tris[1] && tris[1] >= tris[2], `${key}: ${tris}`);
    }
    // A hull is at most two draws (wood, paint) at the middle and far levels.
    for (const lod of [1, 2]) assert.ok(kitOf(modelFor(`vessel:${k}:hull`).build(`vessel:${k}:hull`, lod)).parts.length <= 2, `${k} at ${lod}`);
  }
  for (const key of ['vessel:net', 'vessel:catch', 'vessel:debris']) assert.ok(kitOf(modelFor(key).build(key, 1)).triangles > 0, key);
});

test('ships3d: a rower\'s sweep turns on his bench\'s thole, deep in the water through the drive, clear of it through the recovery', () => {
  for (const kind of KINDS) {
    const P = placesOf(kind);
    if (!P.benches.length) continue;
    for (const b of P.benches) {
      const so = b.clip === 'rowShip' ? 1 : -1;
      // Facing the stern (ry pi): his frame turned a half turn, then at his place.
      const toShip = (v) => new Vector3(-v.x + b.at[0], v.y + b.at[1], -v.z + b.at[2]);
      // The clip's thole, in the ship's frame, on the bench's.
      const thole = toShip(new Vector3(so * ROW_SHIP.out, ROW_SHIP.up, ROW_SHIP.ahead));
      assert.ok(thole.distanceTo(new Vector3(...b.thole)) < 1e-6, `${kind}: the thole`);
      const blade = (t) => {
        const p = poseAt(b.clip, t);
        const grip = p.jointOf('propR');
        const up = new Vector3(0, 1, 0).transformDirection(p.world[BONE.propR]);
        // The line through the thole pin.
        const at = grip.clone().addScaledVector(up, new Vector3(so * ROW_SHIP.out, ROW_SHIP.up, ROW_SHIP.ahead).sub(grip).dot(up));
        assert.ok(at.distanceTo(new Vector3(so * ROW_SHIP.out, ROW_SHIP.up, ROW_SHIP.ahead)) < 1e-3, `${kind} ${b.clip} at ${t}: through the thole`);
        return toShip(grip.clone().addScaledVector(up, ROW_SHIP.oar - 0.2));
      };
      for (const t of [0.15, 0.25, 0.35]) assert.ok(blade(t).y < -0.05, `${kind} bench ${b.k}${b.s > 0 ? 's' : 'p'}: in the water at ${t} (${blade(t).y.toFixed(2)})`);
      for (const t of [0.6, 0.7, 0.8]) assert.ok(blade(t).y > 0.05, `${kind} bench ${b.k}${b.s > 0 ? 's' : 'p'}: clear at ${t} (${blade(t).y.toFixed(2)})`);
      // Out over the side: the blade outboard of the hull's widest.
      assert.ok(Math.abs(blade(0.25).x) > DESIGNS[kind].hull.B / 2, `${kind}: the blade outboard`);
    }
  }
});

test('ships3d: a ship faces the way it goes, turns the short way and eased, lies at its mooring; the sail by the wind', () => {
  const m = new ShipMotion();
  const o = { moving: true, size: 8, wind: [0.6, 0.3], sail: true, row: true };
  // Under way along +x (metres a frame): the bow turns to +x (yaw pi/2) as it goes, never in one step.
  m.begin(0, 1 / 60);
  let st = m.update(1, { x: 0, z: 0 }, { ...o, yaw0: 0 });
  let last = st.yaw;
  for (let i = 1; i <= 240; i++) {
    m.begin(i / 60, 1 / 60);
    st = m.update(1, { x: i * 0.08, z: 0 }, o);
    assert.ok(Math.abs(st.yaw - last) < 0.06, `a jump at ${i}: ${last} -> ${st.yaw}`);
    last = st.yaw;
  }
  assert.ok(Math.abs(st.yaw - Math.PI / 2) < 0.02, `faces +x: ${st.yaw}`);
  assert.ok(st.stroke > 0, 'its rowers pull');
  // Placed exactly where the sim puts it (not moored).
  assert.equal(st.x, 240 * 0.08);
  // The short way: from facing -x (yaw -pi/2 + a little) round to +z... and across the back (pi to -pi).
  m.begin(3, 1 / 60);
  st = m.update(2, { x: 0, z: 0 }, { ...o, yaw0: 3.0 });
  for (let i = 1; i <= 200; i++) {
    m.begin(3 + i / 60, 1 / 60);
    st = m.update(2, { x: -i * 0.08 * Math.sin(0.2), z: -i * 0.08 * Math.cos(0.2) }, o);
  }
  assert.ok(Math.abs(Math.abs(st.yaw) - (Math.PI - 0.2)) < 0.03, `the short way across the back: ${st.yaw}`);
  // Moored: glided to its mooring over MOOR_S, its bow to the mooring's heading.
  const moor = { x: 10, z: 4, yaw: 1.0 };
  m.begin(10, 0.1);
  st = m.update(3, { x: 12, z: 4 }, { moving: false, moor, size: 6, wind: [1, 0] });
  for (let i = 1; i < 80; i++) {
    m.begin(10 + i * 0.1, 0.1);
    st = m.update(3, { x: 12, z: 4 }, { moving: false, moor, size: 6, wind: [1, 0] });
  }
  assert.ok(Math.hypot(st.x - moor.x, st.z - moor.z) < 1e-6 && Math.abs(st.yaw - moor.yaw) < 0.02 && st.moored, JSON.stringify({ x: st.x, z: st.z, yaw: st.yaw }));
  assert.ok(MOOR_S > 0.5 && MOOR_S < 6);
  // The sail: full with the wind astern, square; shivering (aback a little) with it ahead.
  const astern = trimFor(yawOf(1, 0), 1, 0);
  const ahead = trimFor(yawOf(-1, 0), 1, 0);
  const beam = trimFor(yawOf(0, 1), 1, 0);
  assert.ok(astern.fill > 0.95 && Math.abs(astern.brace) < 1e-9, JSON.stringify(astern));
  assert.ok(ahead.fill <= 0.2, JSON.stringify(ahead));
  assert.ok(beam.fill > 0.3 && beam.fill < astern.fill && Math.abs(beam.brace) > 0.3, JSON.stringify(beam));
  // Going down: deeper with time, gone at SINK_S.
  assert.ok(sinkPose(1).down < sinkPose(4).down && sinkPose(SINK_S + 0.1).shows === false && sinkPose(2).shows);
});

/** The corners of a hull's rectangle at (x, y) map tiles, its bow along dir (tiles). */
function hullBox(kind, p) {
  const { half, beam } = extentOf(DESIGNS[kind]);
  const [dx, dy] = p.dir;
  const sx = -dy;
  const sy = dx;
  return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [p.x + (dx * a * half + sx * b * beam) / 4, p.y + (dy * a * half + sy * b * beam) / 4]);
}

test('ships3d: a moored ship sits off its quay, alongside or stern-to, never in the building, the squadron side by side', () => {
  const map = new GameMap(40, 40);
  for (let side = 0; side < 4; side++) {
    const dock = { x: 18, y: 18, size: 3, waterSide: side };
    const f = frontOf(dock);
    const inside = ([x, y]) => x > dock.x + 1e-6 && x < dock.x + dock.size - 1e-6 && y > dock.y + 1e-6 && y < dock.y + dock.size - 1e-6;
    // The clearance from the front's line toward the water, of every corner of the hull.
    const off = ([x, y]) => (f.n[0] ? (x - f.across) * f.n[0] : (y - f.across) * f.n[1]) * 4;
    for (const kind of ['corbita', 'coaster', 'fishing', 'liburnian']) {
      // Its berth anywhere along the front (the sim's berth tile; one at the front's end too).
      for (const along of [-1, 0, 1]) {
        const bx = f.alongX ? dock.x + 1 + along : f.across + f.n[0] * 0.5;
        const by = f.alongX ? f.across + f.n[1] * 0.5 : dock.y + 1 + along;
        const p = alongside(dock, kind, map, map.idx(Math.floor(bx), Math.floor(by)));
        for (const c of hullBox(kind, p)) {
          assert.ok(!inside(c), `${kind} side ${side}: a corner in the building`);
          assert.ok(off(c) >= MOOR_GAP - 1e-6, `${kind} side ${side}: ${off(c).toFixed(2)} m off the quay`);
        }
      }
    }
    // Stern-to: every berth's hull off the front, and the squadron's hulls apart.
    const boxes = [];
    for (let slot = 0; slot < STATION_CAPACITY; slot++) {
      const p = sternTo(dock, 'liburnian', slot);
      const box = hullBox('liburnian', p);
      for (const c of box) assert.ok(off(c) >= MOOR_GAP - 1e-6, `stern-to slot ${slot} side ${side}`);
      boxes.push(p);
    }
    const { beam } = extentOf(DESIGNS.liburnian);
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) assert.ok(Math.hypot(boxes[a].x - boxes[b].x, boxes[a].y - boxes[b].y) * 4 > 2 * beam, `slots ${a}, ${b} touch`);
    }
  }
});

/** A renderer as the pass sees one: the game, a camera, the view's turn, the frame's light, the click spots. */
function fakeRenderer(game) {
  return { game, camera: { scale: 2, x: 0, y: 0 }, viewTurn: 0, env: { lamps: 0, sun: 1 }, frameInfo: { tick: 0, selFort: 0 }, walkerSpots: [], shipSpots: [], selectedWalker: 0, selectedUnit: 0 };
}

test('ships3d: the pass places a ship where the sim puts it, facing its heading, its click along its hull; its crew written once', () => {
  const map = new GameMap(30, 30);
  const game = { map, buildings: new Map(), units: new Map(), walkers: new Map(), military: { people: 'gauls', active: null } };
  const pass = new ShipPass(new Group());
  const r = fakeRenderer(game);
  const u = { id: 7, type: 'liburnian', state: 'sail', moving: true, hp: 180, maxHp: 180, x: 10.5, y: 12.5, px: 10.4, py: 12.5, station: 0 };
  game.units.set(7, u);
  r.shipSpots.push({ id: 7, wx: 0, wy: 0 });
  let writes = 0;
  for (let f = 0; f < 90; f++) {
    u.px = u.x;
    u.x += 0.02; // along the map's +x
    pass.begin(r, f / 60, 1 / 60);
    const it = { kind: 5, u, wx: (u.x - u.y) * HALF_W, wy: (u.x + u.y) * HALF_H, d: u.x + u.y };
    assert.ok(pass.take(it), 'drawn in 3D');
    pass.end();
    if (f === 30) writes = pass.crew.stats.writes;
    if (f === 89) {
      // The hull kit's matrix: at the sim's place (the view's tiles), the bow along +x.
      const hull = pass.kits.slice(0, pass.nKits).find(([key]) => key === 'vessel:liburnian:hull');
      assert.ok(hull, 'its hull placed');
      const m = hull[1];
      const at = new Vector3().setFromMatrixPosition(m);
      assert.ok(Math.abs(at.x - u.x) < 1e-6 && Math.abs(at.z - u.y) < 1e-6, `${at.toArray()} vs ${u.x}, ${u.y}`);
      assert.ok(Math.abs(at.y) < 0.05, 'riding the water');
      const bow = new Vector3(0, 0, 1).transformDirection(m);
      assert.ok(bow.x > 0.99, `facing +x: ${bow.toArray()}`);
      // The click spot from the stern to the bow; the lantern's place on the item, aft of the middle.
      const s = r.shipSpots[0];
      assert.ok(Math.hypot(s.reachX, s.reachY) > 60, JSON.stringify(s));
      assert.ok(it.lamp && it.lamp.wx < (u.x - u.y) * HALF_W, JSON.stringify(it.lamp));
      // Its crew: rowers pulling (on the stroke's clock), marines, the helmsman; written once while the set stays.
      assert.ok(pass.crew.stats.people >= 16, `crew ${pass.crew.stats.people}`);
      assert.equal(pass.crew.stats.writes, writes, 'no rewrite while the set stays');
    }
  }
  // Lost (sunk): it goes down where it was, its debris after.
  u.hp = 0;
  game.units.delete(7);
  pass.begin(r, 2, 1 / 60);
  pass.end();
  assert.equal(pass.stats.wrecks, 1);
  pass.begin(r, 2 + SINK_S + 2, 1 / 60);
  pass.end();
  assert.ok(pass.kits.slice(0, pass.nKits).some(([key]) => key === 'vessel:debris'), 'its debris floats');
  assert.ok(!pass.kits.slice(0, pass.nKits).some(([key]) => key === 'vessel:liburnian:hull'), 'and it is gone');
  pass.dispose();
});

test('ships3d: the benches of every oared design and its rowers match (one rower a bench, both sides)', () => {
  for (const k of KINDS) {
    const d = DESIGNS[k];
    const b = benches(d);
    if (!d.rowers) {
      assert.equal(b.length, 0);
      continue;
    }
    assert.equal(b.length, d.rowers.n * 2, k);
    const rowers = crewOf(k, { mode: 'sail', row: true, sail: true }, { people: 'gauls' }).filter((a) => a.stroke && a.props && a.props.R === 'sweep');
    assert.equal(rowers.length, b.length, k);
  }
  // (The matrix import is used by the pass's own tests above.)
  assert.ok(new Matrix4());
});
