/**
 * units3d.test.mjs - the fighting units drawn as 3D figures (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - every land unit type, with every people, has a look: figures with
 *     pieces that build at every level, clips that exist, colours by its id
 *     (the same each time), the legion's arms (pilum, gladius) as a look of
 *     their own; the signifer and the imperial standards
 *   - a unit stands where the sim puts it (at every view turn, lifted onto a
 *     bridge), faces its way and turns smoothly, its foe when it stands to
 *     fight; a rider sits on his horse's back
 *   - its legs step with the ground it covers (no sliding at any speed, still
 *     paused), a fort's men march in step; the blow lands on the sim's tick
 *   - the beasts' skeleton: its bones in order, every clip a seamless loop
 *     baked as its poses, a planted foot holding its mark, a gallop with its
 *     flights and a walk without, the rider's seat moving with the back
 *   - the threat (who forms the line), the dead kept falling and lying, then
 *     gone; the units' shader patch finds every line it changes
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Group, ShaderLib } from 'three';
import { UNIT_TYPES } from '../src/data/units.js';
import { PEOPLES } from '../src/data/peoples.js';
import { CLIP_INDEX } from '../src/render3d/people/clips.js';
import { unitLook, unitLookKey, unitDrawnIn3D, roleOf } from '../src/render3d/units/look.js';
import { UnitMotion, attackPhase, clipLoop, CORPSE_S, SINK_S } from '../src/render3d/units/motion.js';
import { UnitPass, packUnitFigure } from '../src/render3d/units/pass.js';
import { buildUnitPiece } from '../src/render3d/units/pieces.js';
import { unitMaterial, unitDepthMaterial, UNIT_FIGURE_FLOATS } from '../src/render3d/units/material.js';
import { ThreatGrid } from '../src/render3d/units/threat.js';
import { HIT } from '../src/render3d/units/clips.js';
import {
  QBONES, QBONE_COUNT, LEGS, BEAST_CLIPS, BEAST_CLIP_NAMES, BEAST_CLIP_INDEX, bakeBeasts, beastPoseAt, beastFrames, QFRAME_FLOATS,
  GAITS, gaitFoot, feetDown, riderAt,
} from '../src/render3d/units/quadRig.js';
import { toView } from '../src/render/view.js';
import { TILE_M } from '../src/render3d/walkers/motion.js';
import { ART_PX } from '../src/render3d/projection.js';
import { CONFIG } from '../src/config.js';

const LAND = Object.keys(UNIT_TYPES).filter(unitDrawnIn3D);

/** A unit as the sim makes one (the fields the renderer reads). */
function unit(type, o = {}) {
  const def = UNIT_TYPES[type];
  return { id: 11, type, side: def.side, x: 10.5, y: 8.5, px: 10.5, py: 8.5, hp: def.hp, maxHp: def.hp, moving: false, walked: 0, strikeTick: -99, hitTick: -99, state: 'idle', fort: 0, slot: 0, target: 0, ...o };
}

test('units3d: every land unit, of every people, has a look whose pieces build and whose clips exist', () => {
  assert.ok(LAND.length >= 16, `${LAND.length} land types`);
  assert.ok(!unitDrawnIn3D('liburnian') && !unitDrawnIn3D('raider_ship'), 'ships are not this pass\'s');
  const keys = new Set();
  for (const type of LAND) {
    for (const people of ['', ...Object.keys(PEOPLES)]) {
      for (const arms of ['march', 'battle']) {
        const u = unit(type, { id: 17 });
        const look = unitLook(u, { people, arms });
        assert.ok(look.figures.length >= 1, `${type} ${people}`);
        assert.equal(look.key, unitLookKey(u, { people, arms }));
        look.figures.forEach((f, i) => {
          const p = packUnitFigure(f, i);
          assert.ok(p.pieces.length >= 1 && p.col0.every(Number.isFinite) && p.col1.every(Number.isFinite), `${type}: figure ${i} packed`);
          for (const k of p.pieces) keys.add(k);
          if (f.person) for (const c of Object.values(f.clips)) assert.ok(c in CLIP_INDEX, `${type}: clip ${c}`);
          if (f.quad) for (const c of Object.values(f.clips)) assert.ok(c in BEAST_CLIP_INDEX, `${type}: beast clip ${c}`);
          if (f.mount >= 0) assert.ok(look.figures[f.mount].quad, `${type}: rides a beast`);
        });
        // Stable: the same unit, the same look.
        assert.deepEqual(JSON.stringify(unitLook(u, { people, arms }).figures), JSON.stringify(look.figures));
      }
    }
  }
  // Every piece of every look builds at every level, its weights normalised and its vertices finite.
  for (const k of keys) {
    for (const lod of [0, 1, 2]) {
      const g = buildUnitPiece(k, lod);
      const pos = g.attributes.position.array;
      assert.ok(pos.length > 0 && pos.every(Number.isFinite), `${k} at ${lod}`);
      const w = g.attributes.aWeights.array;
      // (A car's pieces are hinged, not skinned: their weights are the hinge's numbers.)
      if (!k.startsWith('cart:')) for (let i = 0; i < w.length; i += 4) assert.ok(Math.abs(w[i] + w[i + 1] + w[i + 2] + w[i + 3] - 1) < 1e-4, `${k}: weights`);
      g.dispose();
    }
  }
  // The legion's arms: a pilum on the march, a gladius in battle; the signifer his standard, Caesar's the eagle.
  const leg = (arms, o = {}) => unitLook(unit('legionary', { id: 30, fort: 4, slot: 3, ...o }), { arms }).figures[0].props.R;
  assert.equal(leg('march'), 'uprop:pilum');
  assert.equal(leg('battle'), 'prop:gladius');
  assert.equal(roleOf(unit('legionary', { fort: 4, slot: 0 })), 'signifer');
  assert.equal(unitLook(unit('legionary', { fort: 4, slot: 0 }), {}).figures[0].props.R, 'uprop:signum');
  assert.equal(unitLook(unit('imperial', { id: 5 }), {}).figures[0].props.R, 'uprop:aquila');
  // A Gaul is not a Carthaginian: the people dress the same type differently.
  const g1 = JSON.stringify(unitLook(unit('raider'), { people: 'gauls' }).figures);
  const g2 = JSON.stringify(unitLook(unit('raider'), { people: 'carthaginians' }).figures);
  assert.notEqual(g1, g2);
});

/** Place one unit with a fresh motion's frame: the figure texture's cells. */
function placeOnce(m, u, look, at, tick = 100) {
  m.begin(tick);
  const out = new Float32Array(UNIT_FIGURE_FLOATS * look.figures.length);
  const p = m.place(u, look, { lift: 0, stride: u.walked, vt: 0, W: 40, H: 30, dx: 0, dy: 0, foe: null, threat: false, threatDist: 99, charging: false, fx: u.x, fy: u.y, ...at }, out, 0);
  return { out, p };
}

test('units3d: a unit stands where the sim puts it at every turn, faces its way and its foe, turns smoothly', () => {
  for (const vt of [0, 1, 2, 3]) {
    const m = new UnitMotion();
    const u = unit('legionary');
    const look = unitLook(u, {});
    const { out } = placeOnce(m, u, look, { vt, fx: 12.25, fy: 7.75, lift: 3 });
    const [vu, vv] = toView(12.25, 7.75, vt, 40, 30);
    assert.ok(Math.abs(out[0] - vu * TILE_M) < 1e-4 && Math.abs(out[2] - vv * TILE_M) < 1e-4, `turn ${vt}: placed`);
    assert.ok(Math.abs(out[1] - 3 * ART_PX * TILE_M) < 1e-4, 'lifted onto the deck');
  }
  // Moving along +x of the map (unturned): faces +x (yaw pi/2), turning there over the ground covered.
  const m = new UnitMotion();
  const u = unit('legionary', { moving: true });
  const look = unitLook(u, {});
  let yaw = 0;
  let last = null;
  for (let k = 0; k < 40; k++) {
    u.walked += 0.075;
    u.x += 0.075;
    const { out } = placeOnce(m, u, look, { dx: 0.075, dy: 0, stride: u.walked }, 100 + k);
    yaw = out[3];
    if (last !== null) assert.ok(Math.abs(yaw - last) < 0.5, 'no jump in the turn');
    last = yaw;
  }
  assert.ok(Math.abs(yaw - Math.PI / 2) < 0.05, `faces its way: ${yaw}`);
  // Standing to fight a foe toward +y: turns to face him.
  u.moving = false;
  for (let k = 0; k < 60; k++) placeOnce(m, u, look, { foe: [0, 1] }, 140 + k);
  const { out } = placeOnce(m, u, look, { foe: [0, 1] }, 200);
  assert.ok(Math.abs(out[3]) < 0.05, `faces his foe: ${out[3]}`);
});

test('units3d: the legs step with the ground covered, still when paused; a fort marches in step; the blow on the tick', () => {
  const m = new UnitMotion();
  const u = unit('legionary', { moving: true, fort: 0 });
  const look = unitLook(u, {});
  const name = look.figures[0].clips.move;
  const { dur, stride } = clipLoop(name, false);
  assert.ok(stride > 1, 'a walking clip with its stride');
  const times = [];
  for (let k = 0; k < 4; k++) {
    u.walked += 0.05;
    const { out } = placeOnce(m, u, look, { dx: 0.05, stride: u.walked }, 100 + k);
    times.push(out[5]);
  }
  // 0.05 tiles a step: the clip's time moves by that ground over its stride, whatever the clock did.
  const step = ((times[3] - times[2] + dur) % dur);
  assert.ok(Math.abs(step - (0.05 * TILE_M / stride) * dur) < 1e-3, `in step with the ground: ${step}`);
  // Paused: the same tick and ground, the same pose.
  const a = placeOnce(m, u, look, { dx: 0.05, stride: u.walked }, 103).out.slice();
  const b = placeOnce(m, u, look, { dx: 0.05, stride: u.walked }, 103).out;
  assert.equal(a[5], b[5]);
  // Two men of one fort, walked different distances, come into step over a few seconds of marching.
  const m2 = new UnitMotion();
  const men = [unit('legionary', { id: 1, fort: 7, slot: 1, moving: true, walked: 0 }), unit('legionary', { id: 2, fort: 7, slot: 2, moving: true, walked: 3.37 })];
  const looks = men.map((v) => unitLook(v, {}));
  let diff = 1;
  const speed = UNIT_TYPES.legionary.speed;
  for (let k = 0; k < 400; k++) {
    m2.begin(1000 + k);
    const ph = men.map((v, i) => {
      v.walked += speed;
      const out = new Float32Array(UNIT_FIGURE_FLOATS);
      m2.place(v, looks[i], { fx: v.x, fy: v.y, lift: 0, stride: v.walked, vt: 0, W: 40, H: 30, dx: speed, dy: 0, foe: null }, out, 0);
      return out[5] / dur;
    });
    diff = Math.abs(((ph[0] - ph[1] + 1.5) % 1) - 0.5);
  }
  assert.ok(diff < 0.02, `in step: ${diff}`);
  // A blow: the attack clip at its HIT phase on the strike's tick, a cooldown on at the next.
  const cd = UNIT_TYPES.legionary.cooldown;
  assert.ok(Math.abs(attackPhase(HIT.fight, 0, cd) - HIT.fight) < 1e-9);
  assert.ok(Math.abs(attackPhase(HIT.fight, cd, cd) - HIT.fight) < 1e-9);
  const f = unit('legionary', { strikeTick: 500, state: 'fight', fort: 0 });
  const fl = unitLook(f, { arms: 'battle' });
  const { out } = placeOnce(new UnitMotion(), f, fl, {}, 500);
  assert.equal(out[4], CLIP_INDEX.fight);
  assert.ok(Math.abs(out[5] / clipLoop('fight', false).dur - HIT.fight) < 1e-6, 'the thrust lands on the tick');
});

test('units3d: a rider sits on his horse\'s back, rocked with its stride; the cavalry gallops when it charges', () => {
  const m = new UnitMotion();
  const u = unit('cavalry', { moving: true, state: 'engage' });
  const look = unitLook(u, {});
  assert.equal(look.figures[0].mount, 1);
  const ys = [];
  for (let k = 0; k < 20; k++) {
    u.walked += 0.13;
    const { out } = placeOnce(m, u, look, { dx: 0.13, stride: u.walked, charging: true }, 100 + k);
    const horse = out.subarray(UNIT_FIGURE_FLOATS, UNIT_FIGURE_FLOATS * 2);
    assert.equal(horse[4], BEAST_CLIP_INDEX['horse:gallop']);
    // The rider's hips (0.95 over his own feet) on the saddle, over the horse.
    ys.push(out[1] + 0.95);
    assert.ok(Math.hypot(out[0] - horse[0], out[2] - horse[2]) < 0.3, 'over the horse');
  }
  assert.ok(Math.min(...ys) > 1.3 && Math.max(...ys) < 1.55, `on the saddle: ${Math.min(...ys)}..${Math.max(...ys)}`);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.01, 'rocked by the gallop');
});

test('units3d: the beasts\' skeleton, its clips seamless and baked, the feet planted, the gaits\' footfalls', () => {
  QBONES.forEach((b, i) => assert.ok(b.parent < i, `${b.name} after its parent`));
  assert.ok(QBONE_COUNT <= 32);
  const B = bakeBeasts();
  assert.equal(B.table.length, BEAST_CLIP_NAMES.length);
  assert.ok(B.data.every(Number.isFinite));
  for (const name of BEAST_CLIP_NAMES) {
    const a = beastPoseAt(name, 0);
    const b = beastPoseAt(name, 1 - 1e-7);
    let d = 0;
    for (let i = 0; i < QBONE_COUNT; i++) for (let k = 0; k < 16; k++) d = Math.max(d, Math.abs(a.world[i].elements[k] - b.world[i].elements[k]));
    assert.ok(d < 3e-3, `${name}: its seam moves ${d}`);
    const c = B.table[BEAST_CLIP_INDEX[name]];
    assert.equal(c.frames, beastFrames(name));
    const f = Math.floor(c.frames / 3);
    const want = beastPoseAt(name, f / c.frames).write(new Float32Array(QFRAME_FLOATS));
    const got = B.data.subarray((c.start + f) * QFRAME_FLOATS, (c.start + f + 1) * QFRAME_FLOATS);
    for (let i = 0; i < QFRAME_FLOATS; i++) assert.ok(Math.abs(want[i] - got[i]) < 1e-5, `${name} baked`);
    // No joint of a leg parts from the next.
    for (let i = 0; i < 12; i++) {
      const P = beastPoseAt(name, i / 12);
      for (const leg of LEGS) {
        for (let k = 0; k < 3; k++) {
          const end = P.carry(leg[k], P.J[leg[k + 1]]);
          assert.ok(end.distanceTo(P.jointOf(leg[k + 1])) < 1e-3, `${name}: a leg holds together`);
        }
      }
    }
  }
  // A planted foot holds its mark (its ground moving back at the stride's speed): within 4 cm at a gallop's
  // reach, where the leg's two bones are stretched to the full and the foot is let rise a little.
  for (const name of ['wolf:trot', 'wolf:lope', 'horse:gallop', 'horse:canter', 'elephant:walk']) {
    const G = GAITS[BEAST_CLIPS[name].gait];
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const P = beastPoseAt(name, t);
      for (let l = 0; l < 4; l++) {
        const ft = gaitFoot(G, l, t);
        if (!ft.down || (t - G.phase[l] + 1) % 1 > G.duty * 0.7) continue;
        const j = P.jointOf(LEGS[l][3]);
        const rest = P.J[LEGS[l][3]];
        assert.ok(Math.hypot(j.z - rest[2] - ft.z, j.y - rest[1]) < 0.04, `${name}: leg ${l} planted at ${t}`);
      }
    }
  }
  // A gallop has its flights (no foot down); a walk always has two or more.
  assert.ok([...Array(40)].some((_, i) => feetDown('horse:gallop', i / 40) === 0), 'the gallop\'s flight');
  assert.ok([...Array(40)].every((_, i) => feetDown('horse:walk', i / 40) >= 2), 'the walk never flies');
  // The rider's seat on a gallop rises and falls, its pitch small.
  const ys = [...Array(20)].map((_, i) => riderAt('horse:gallop', (i / 20) * BEAST_CLIPS['horse:gallop'].dur).y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.01 && ys.every((y) => Math.abs(y) < 0.2));
});

test('units3d: who is threatened, the dead kept falling and lying then gone, the shader patch', () => {
  const grid = new ThreatGrid();
  const r = unit('legionary', { x: 10, y: 10 });
  const g = unit('swordsman', { x: 14, y: 10 });
  const w = unit('wolf', { x: 40, y: 40 });
  const v = unit('villager', { x: 11, y: 10 });
  grid.build([r, g, w, v]);
  assert.ok(Math.abs(grid.nearest(r) - 4) < 1e-9, 'the Gaul four tiles off');
  assert.equal(grid.nearest(v), Infinity, 'a villager at peace is nobody\'s foe');
  // The dead: kept from the tick the sim lets them go, falling, then gone after CORPSE_S + SINK_S.
  const pass = new UnitPass(new Group());
  const u = unit('swordsman', { id: 77 });
  const view = { vt: 0, W: 40, H: 30, x0: -1e5, x1: 1e5, y0: -1e5, y1: 1e5 };
  const frame = (tick, list) => {
    pass.begin(2, tick, list, view);
    for (const x of list) if (pass.canDraw(x, { people: 'gauls' }, null)) pass.add(x, { fx: x.x, fy: x.y, lift: 0, stride: 0, vt: 0, W: 40, H: 30, dx: 0, dy: 0, foe: null });
    pass.end();
  };
  for (let k = 0; k < 200 && pass.stats.units < 1; k++) frame(k, [u]);
  assert.equal(pass.stats.units, 1);
  const writes = pass.stats.writes;
  frame(201, [u]);
  assert.equal(pass.stats.writes, writes, 'nothing written for the same set');
  // A neighbour the sim still has is never taken for the fallen; the fallen one is.
  assert.ok(!pass.died({ x: u.x, y: u.y, type: u.type }, new Map([[u.id, u]])));
  assert.ok(pass.died({ x: u.x, y: u.y, type: u.type }, new Map()));
  frame(202, []);
  assert.equal(pass.stats.dead, 1);
  assert.equal(pass.stats.units, 0);
  const TPS = CONFIG.TICKS_PER_SECOND;
  frame(202 + (CORPSE_S + SINK_S + 1) * TPS, []);
  assert.equal(pass.stats.dead, 0, 'gone');
  pass.dispose();
  // The shader patch: the people's, then the units' variant (the beasts' skinning, the flag's ripple).
  const shader = (lib) => ({ uniforms: {}, vertexShader: ShaderLib[lib].vertexShader, fragmentShader: ShaderLib[lib].fragmentShader });
  const s = shader('physical');
  unitMaterial().onBeforeCompile(s, null);
  assert.match(s.vertexShader, /beastSkin\( f1\.x, f1\.y \)/);
  assert.match(s.vertexShader, /transformed = transformed \* aActRoute\.x \+ pWalk;/);
  assert.ok(s.uniforms.uUnits && s.uniforms.uBeastBones && s.uniforms.uPeopleBones);
  for (const kind of ['depth', 'distance']) {
    const d = shader(kind);
    unitDepthMaterial(kind).onBeforeCompile(d, null);
    assert.match(d.vertexShader, /pWalk/);
  }
});
