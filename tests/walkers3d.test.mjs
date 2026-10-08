/**
 * walkers3d.test.mjs - the walkers drawn as 3D people (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - every walker type but the ships has a look: a dressed person (or more),
 *     what it carries, clips that exist (a walking clip with a stride, a
 *     standing one), its look stable by its id; every piece of every look
 *     builds at every level, skinned to the rig or hinged as a rigid piece
 *   - each figure stands where renderer.js walkerWorld puts the walker, at
 *     every view turn, lifted onto a bridge as the sprite is; it faces its
 *     way and turns smoothly at a corner, the short way, never in a jump
 *   - the clips play by the distance walked over the clip's stride (the feet
 *     hold the ground at any game speed) and stand still while paused; a
 *     prefect runs to a fire and throws water at it
 *   - a family and its mules follow the way the walker came (on his road,
 *     not across the corner); a cart goes before its pusher
 *   - the walkers' shader patch finds every line it changes; the pass writes
 *     its instances only when the set changes, its figures every frame
 *   - a click on a 3D walker's cart (any way it points) picks him
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Group, ShaderLib } from 'three';
import { WALKER_TYPES } from '../src/data/walkers.js';
import { walkerLook, drawnIn3D, lookKey } from '../src/render3d/walkers/look.js';
import { WalkerMotion, clipStride, TILE_M, yawOf, FADE } from '../src/render3d/walkers/motion.js';
import { WalkerPass, buildWalkerPiece, packFigure } from '../src/render3d/walkers/pass.js';
import { walkerMaterial, walkerDepthMaterial, FIGURE_FLOATS } from '../src/render3d/walkers/material.js';
import { CLIPS, CLIP_INDEX } from '../src/render3d/people/clips.js';
import { BONE_COUNT } from '../src/render3d/people/rig.js';
import { walkerWorld, Renderer } from '../src/render/renderer.js';
import { toView } from '../src/render/view.js';
import { ART_PX } from '../src/render3d/projection.js';
import { HALF_W, HALF_H } from '../src/config.js';

/** A walker as the sim makes one (the fields the renderer reads). */
function walker(type, o = {}) {
  return { id: 7, type, kind: WALKER_TYPES[type].kind, x: 10, y: 10, tx: 11, ty: 10, progress: 0.25, moving: true, lastDir: 1, walked: 3, speed: 0.1, state: 'roam', cargo: null, people: 0, ...o };
}

/** The variants that look different: by what they carry, their family, their venue. */
function variants(type) {
  const out = [[walker(type), {}]];
  if (type === 'cart') {
    out.push([walker(type, { cargo: { good: 'wine', amount: 200 } }), { origin: { kind: 'workshop' } }]);
    out.push([walker(type, { cargo: { good: 'wheat', amount: 400 } }), { origin: { kind: 'farm', produces: 'wheat' } }]);
    out.push([walker(type, { cargo: { good: 'horses', amount: 200 } }), { origin: { kind: 'ranch', produces: 'horses' } }]);
  }
  if (type === 'immigrant') out.push([walker(type, { people: 3 }), {}], [walker(type, { mule: true }), {}]);
  if (type === 'caravan') out.push([walker(type, { packs: ['wine', 'iron'] }), {}]);
  if (type === 'entertainer' || type === 'performer') for (const venue of ['theater', 'amphitheater', 'colosseum', 'hippodrome']) out.push([walker(type, { venue }), { venue }]);
  return out;
}

const TYPES = Object.keys(WALKER_TYPES).filter(drawnIn3D);

test('walkers3d: every walker type but the ships is drawn in 3D, dressed, carrying what its job carries', () => {
  assert.ok(!drawnIn3D('ship') && !drawnIn3D('fishing_boat'), 'ships keep their sprites');
  assert.equal(TYPES.length, Object.values(WALKER_TYPES).filter((d) => d.kind !== 'ship').length);
  for (const type of TYPES) {
    for (const [w, ctx] of variants(type)) {
      const look = walkerLook(w, ctx);
      const say = `${type} ${JSON.stringify(ctx)} ${w.cargo ? w.cargo.good : ''}`;
      assert.ok(look.figures.length >= 1 && look.figures[0].person, `${say}: a person first`);
      const packed = look.figures.map((f, i) => packFigure(f, i));
      // Dressed: a body and at least one garment; carrying something (a prop, a cart, a beast) or riding in a chariot.
      const lead = packed[0].pieces;
      assert.ok(lead[0].startsWith('body:') && lead.some((p) => /^(tunic|toga|limus|paenula|pallium|palla)/.test(p)), `${say}: dressed (${lead})`);
      const carries = packed.some((f) => f.pieces.some((p) => p.startsWith('prop:') || p.startsWith('wprop:') || p.startsWith('cart:') || p.startsWith('beast:')));
      assert.ok(carries, `${say}: carries something`);
      for (const f of look.figures) {
        if (!f.person) continue;
        assert.ok(CLIPS[f.move], `${say}: ${f.move}`);
        // (A charioteer stands in his car: he drives, he does not walk.)
        if (f.lift) continue;
        assert.ok(CLIPS[f.move].walk, `${say}: ${f.move} walks`);
        assert.ok(CLIPS[f.stand], `${say}: ${f.stand} stands`);
        assert.ok(clipStride(f.move) > 1, `${say}: ${f.move} has a stride`);
      }
      // Stable by its id: the same look, made again.
      assert.deepEqual(walkerLook(w, ctx).figures.map((f, i) => packFigure(f, i).col0), packed.map((f) => f.col0), `${say}: stable colours`);
      assert.equal(look.key, lookKey(w, ctx));
    }
  }
  // Two walkers of a type are not dressed alike.
  const cols = new Set();
  for (let id = 1; id < 30; id++) cols.add(packFigure(walkerLook(walker('teacher', { id })).figures[0], id).col0.join());
  assert.ok(cols.size > 5, `${cols.size} looks among 29 teachers`);
});

test('walkers3d: every piece of every look builds at every level, skinned to the rig or hinged', () => {
  const keys = new Set();
  for (const type of TYPES) for (const [w, ctx] of variants(type)) for (const f of walkerLook(w, ctx).figures) for (const k of packFigure(f, 0).pieces) keys.add(k);
  for (const key of keys) {
    let last = Infinity;
    for (const lod of [0, 1, 2]) {
      const g = buildWalkerPiece(key, lod);
      for (const v of g.attributes.position.array) assert.ok(Number.isFinite(v), `${key}@${lod}: a position`);
      for (const v of g.attributes.normal.array) assert.ok(Number.isFinite(v), `${key}@${lod}: a normal`);
      const b = g.attributes.aBones.array;
      const w = g.attributes.aWeights.array;
      const rigid = key.startsWith('beast:') || key.startsWith('cart:') || key === 'rope';
      for (let i = 0; i < b.length; i += 4) {
        if (rigid) assert.ok(b[i] <= 10, `${key}: hinge ${b[i]}`);
        else {
          assert.ok(Math.abs(w[i] + w[i + 1] + w[i + 2] + w[i + 3] - 1) < 1e-5, `${key}@${lod}: weights`);
          for (let k = 0; k < 4; k++) assert.ok(b[i + k] < BONE_COUNT, `${key}@${lod}: bone`);
        }
      }
      const t = g.index.count / 3;
      assert.ok(t > 0 && t <= last, `${key}: level ${lod} (${t}) no heavier than the one before (${last})`);
      last = t;
    }
  }
});

/** Place walker `w` once at view turn `vt` and return the figures' floats and the leader. */
function place(motion, w, look, vt = 0, lift = 0, time = 0, dt = 1 / 60) {
  motion.begin(time, dt);
  const out = new Float32Array(look.figures.length * FIGURE_FLOATS);
  const W = 60;
  const H = 50;
  const at = walkerWorld(w, 0, vt, W, H);
  const p = w.moving ? w.progress : 0;
  const lead = motion.place(w, look, { fx: at.fx, fy: at.fy, lift, stride: w.walked + 0 * p, vt, W, H, aim: null }, out, 0);
  return { out, lead, at };
}

test('walkers3d: a walker stands where walkerWorld puts him at every view turn, and faces his way', () => {
  const W = 60;
  const H = 50;
  for (let vt = 0; vt < 4; vt++) {
    const motion = new WalkerMotion();
    const w = walker('priest', { x: 10, y: 12, tx: 11, ty: 12, progress: 0.4 });
    const look = walkerLook(w);
    const { out, at } = place(motion, w, look, vt, 6);
    const [u, v] = toView(at.fx, at.fy, vt, W, H);
    assert.ok(Math.abs(out[0] - u * TILE_M) < 1e-4 && Math.abs(out[2] - v * TILE_M) < 1e-4, `turn ${vt}: on his spot`);
    // (The sprite's px a pixel's height: the same lift in 3D, a bridge's deck.)
    assert.ok(Math.abs(out[1] - 6 * ART_PX * TILE_M) < 1e-5, `turn ${vt}: lifted onto the deck`);
    // Facing east on the map: the view's step of (1, 0) at this turn.
    const step = [[1, 0], [0, 1], [-1, 0], [0, -1]][vt];
    assert.ok(Math.abs(Math.atan2(Math.sin(out[3] - yawOf(...step)), Math.cos(out[3] - yawOf(...step)))) < 1e-6, `turn ${vt}: faces his way (${out[3]})`);
    // On the screen his facing points where walkerWorld moves him.
    const ahead = walkerWorld({ ...w, progress: 0.9 }, 0, vt, W, H);
    const fx = Math.sin(out[3]);
    const fz = Math.cos(out[3]);
    const sx = (fx - fz) * HALF_W;
    const sy = (fx + fz) * HALF_H;
    assert.ok(sx * (ahead.wx - at.wx) + sy * (ahead.wy - at.wy) > 0, `turn ${vt}: on screen, toward where he goes`);
  }
});

test('walkers3d: turning a corner is smooth and the short way; the clip follows the ground walked, not the clock', () => {
  const motion = new WalkerMotion();
  const w = walker('teacher', { x: 10, y: 10, tx: 11, ty: 10, progress: 0, walked: 0 });
  const look = walkerLook(w);
  let yaw = null;
  let maxStep = 0;
  let t = 0;
  // East along a row, then north (a corner), 0.1 tiles a tick at 60 frames a second, 0.8 tiles a second.
  const path = [];
  for (let k = 0; k < 120; k++) path.push(k < 60 ? [10 + k / 30, 10, 1, 0] : [12, 10 - (k - 60) / 30, 0, -1]);
  let clipT = null;
  for (const [fx, fy, dx, dy] of path) {
    t += 1 / 60;
    w.x = Math.floor(fx); w.y = Math.ceil(fy - 1e-9); w.tx = w.x + dx; w.ty = w.y + dy;
    w.walked = (w.walked + 0.8 / 60) % 100;
    motion.begin(t, 1 / 60);
    const out = new Float32Array(FIGURE_FLOATS);
    motion.place(w, look, { fx: fx + 0.5, fy: fy + 0.5, lift: 0, stride: w.walked, vt: 0, W: 60, H: 50, aim: null }, out, 0);
    if (yaw !== null) maxStep = Math.max(maxStep, Math.abs(Math.atan2(Math.sin(out[3] - yaw), Math.cos(out[3] - yaw))));
    yaw = out[3];
    // The clip's time advances by the metres walked over its stride (its loop's length in seconds).
    const name = look.figures[0].move;
    const per = (0.8 / 60) * TILE_M / clipStride(name) * CLIPS[name].dur;
    if (clipT !== null) {
      let d = out[5] - clipT;
      d -= Math.round(d / CLIPS[name].dur) * CLIPS[name].dur;
      assert.ok(Math.abs(d - per) < 1e-4, `clip time step ${d} for ${per}`);
    }
    assert.equal(out[4], CLIP_INDEX[name]);
    clipT = out[5];
  }
  // East (pi/2) to north (pi: the view's -v), turned the short way and never more than a little a frame.
  assert.ok(Math.abs(Math.abs(yaw) - Math.PI) < 0.05, `faces north at the end (${yaw})`);
  assert.ok(maxStep < 0.2, `a smooth turn (largest step ${maxStep} rad a frame)`);
  // Paused: nothing walked, the clip holds, whatever the clock does.
  const out = new Float32Array(FIGURE_FLOATS);
  motion.begin(t + 5, 1 / 60);
  motion.place(w, look, { fx: 12.5, fy: 7.5, lift: 0, stride: w.walked, vt: 0, W: 60, H: 50, aim: null }, out, 0);
  assert.ok(Math.abs(out[5] - clipT) < 1e-6, 'paused: the legs hold still');
});

test('walkers3d: a prefect runs to a fire and throws water at it; stopping fades into standing', () => {
  const motion = new WalkerMotion();
  const w = walker('prefect', { state: 'toFire' });
  const look = walkerLook(w);
  let r = place(motion, w, look, 0, 0, 1);
  assert.equal(r.out[4], CLIP_INDEX.run);
  w.state = 'extinguish';
  w.moving = false;
  // (Held moving a moment: a tick's stop on a tile is no stop.)
  r = place(motion, w, look, 0, 0, 2);
  assert.equal(r.out[4], CLIP_INDEX.douse);
  assert.equal(r.out[6], CLIP_INDEX.run, 'faded from the run');
  assert.ok(r.out[8] < 0.05, 'the fade starts');
  r = place(motion, w, look, 0, 0, 2 + FADE + 0.01);
  assert.equal(r.out[8], 1, 'the fade done');
});

test('walkers3d: a family and a mule follow the way he came; a cart goes before its pusher', () => {
  const motion = new WalkerMotion();
  const w = walker('immigrant', { people: 3, x: 10, y: 10, tx: 11, ty: 10, walked: 0 });
  const look = walkerLook(w);
  const n = look.figures.length;
  const out = new Float32Array(n * FIGURE_FLOATS);
  let t = 0;
  // East 4 tiles, then south 3: the followers end on the road (x 14.5 or y 10.5), never across the corner.
  for (let k = 0; k < 7 * 30; k++) {
    t += 1 / 60;
    const east = k < 120;
    const fx = east ? 10 + k / 30 : 14;
    const fy = east ? 10 : 10 + (k - 120) / 30;
    w.walked = (w.walked + 0.8 / 60) % 100;
    w.tx = east ? 11 : 14; w.ty = east ? 10 : 11; w.x = east ? 10 : 14; w.y = 10;
    motion.begin(t, 1 / 60);
    motion.place(w, look, { fx: fx + 0.5, fy: fy + 0.5, lift: 0, stride: w.walked, vt: 0, W: 60, H: 50, aim: null }, out, 0);
    if (k > 150) {
      for (let f = 1; f < n; f++) {
        const x = out[f * FIGURE_FLOATS] / TILE_M;
        const y = out[f * FIGURE_FLOATS + 2] / TILE_M;
        const side = Math.abs(look.figures[f].place.side || 0) / TILE_M + 0.02;
        assert.ok(Math.abs(y - 10.5) <= side || Math.abs(x - 14.5) <= side, `follower ${f} on the road at ${x.toFixed(2)}, ${y.toFixed(2)}`);
      }
    }
  }
  // Behind him: each follower nearer where he came from.
  for (let f = 1; f < n; f++) assert.ok(out[f * FIGURE_FLOATS + 2] < out[2], `follower ${f} behind him`);
  // A cart before its pusher, along his facing.
  const m2 = new WalkerMotion();
  const cw = walker('cart', { cargo: { good: 'wine', amount: 200 } });
  const cl = walkerLook(cw, { origin: { kind: 'workshop' } });
  const r = place(m2, cw, cl);
  assert.ok(r.out[FIGURE_FLOATS] === r.out[0] && Math.abs(r.out[FIGURE_FLOATS + 3] - r.out[3]) < 1e-9, 'the cart in his frame');
  assert.ok(cl.reach > 1.5 && walkerLook(walker('immigrant', { people: 3 })).reach < -0.5, 'the click reaches the cart ahead, the family behind');
  assert.equal(cl.loads[0].good, 'wine');
});

test('walkers3d: the walkers\' shader patch finds every line it changes', () => {
  const shader = (lib) => ({ uniforms: {}, vertexShader: ShaderLib[lib].vertexShader, fragmentShader: ShaderLib[lib].fragmentShader });
  const s = shader('physical');
  walkerMaterial().onBeforeCompile(s, null);
  assert.match(s.vertexShader, /uWalkers/);
  assert.match(s.vertexShader, /transformed = transformed \* aActRoute\.x \+ pWalk;/);
  assert.ok(!/aActRoute\.y \* \( 0\.5 - 0\.5 \* cos\( 6\.28/.test(s.vertexShader));
  assert.ok(s.uniforms.uWalkers && s.uniforms.uPeopleBones, 'the figures and the clips');
  for (const [lib, kind] of [['depth', 'depth'], ['distance', 'distance']]) {
    const d = shader(lib);
    walkerDepthMaterial(kind).onBeforeCompile(d, null);
    assert.match(d.vertexShader, /pWalk/);
  }
});

test('walkers3d: the pass writes instances only when the set in view changes, the figures every frame', () => {
  const pass = new WalkerPass(new Group());
  const ws = ['teacher', 'cart', 'caravan'].map((type, i) => walker(type, { id: 20 + i, packs: ['wine'], cargo: type === 'cart' ? { good: 'iron', amount: 100 } : null }));
  const frame = (list, t) => {
    pass.begin(2, t, 1 / 60);
    for (const w of list) if (pass.canDraw(w, {})) pass.add(w, { ...walkerWorld(w, 0), lift: 0, stride: w.walked, vt: 0, W: 60, H: 50, aim: null }, {});
    pass.end();
  };
  // (The first frames build the pieces; drawn once all of a walker's are built.)
  for (let k = 0; k < 200 && pass.stats.walkers < ws.length; k++) frame(ws, k / 60);
  assert.equal(pass.stats.walkers, 3);
  assert.equal(pass.stats.figures, 1 + 2 + 5);
  assert.ok(pass.loads.length >= 1, 'the cart\'s iron');
  const writes = pass.stats.writes;
  const v = pass.tex.version;
  for (const w of ws) w.walked += 0.05;
  frame(ws, 4);
  assert.equal(pass.stats.writes, writes, 'nothing written for the same set');
  assert.ok(pass.tex.version > v, 'the figures sent');
  frame(ws.slice(1), 4.1);
  assert.ok(pass.stats.writes > writes, 'a walker out of view: written again');
  assert.equal(pass.stats.walkers, 2);
  pass.dispose();
});

test('walkers3d: a click on a 3D walker\'s cart picks him, whichever way the cart points', () => {
  const cam = { dpr: 1, scale: 2, screenToWorld: (x, y) => ({ x: x / 2, y: y / 2 }) };
  for (const [rx, ry] of [[30, 15], [-30, 15], [30, -15], [-30, -15]]) {
    const r = { camera: cam, walkerSpots: [{ id: 5, wx: 100, wy: 100, d: 0, ship: false, reachX: rx, reachY: ry }], coverStrips: [] };
    const pick = (wx, wy) => Renderer.prototype.pickWalker.call(r, wx * 2, wy * 2, false);
    assert.equal(pick(100 + rx, 100 + ry - 4), 5, `the cart's far end (${rx}, ${ry})`);
    assert.equal(pick(100 - rx, 100 - ry - 4), 0, `not the other way (${rx}, ${ry})`);
  }
});
