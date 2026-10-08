/**
 * people3d.test.mjs - the 3D look's people: rig, clips, pieces, actors (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the rig: 25 bones, each after its parent, the hands' prop bones
 *   - the clips loop seamlessly (the last frame runs into the first), are
 *     baked as their poses, and plant the feet where they ask
 *   - every piece at every level: its weights sum to 1 over four bones of
 *     the rig, each level lighter than the one before, a person within the
 *     triangle budgets (about 6,000 / 1,500 / 400)
 *   - the people's shader patch finds every line it changes (the look's, three's)
 *   - actors pack as specified: their pieces, a toga wearer's toga clips,
 *     the colours stable, a route's ends' facings
 *   - the model pass gathers the actors of the buildings it draws, by their
 *     state, writes them again only when the set changes (a turn, a state, a
 *     building in or out of view), and draws nobody for a building not drawn
 *   - every converted building keeps its people on its own footprint at
 *     every view turn; its walkers turn the short way, never jump, keep
 *     the walk's clock (routePose, the shader's twin); the temples' priests
 *     walk clear of their altars
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Group, Matrix4, Vector3, ShaderLib } from 'three';
import { BONES, BONE, BONE_COUNT } from '../src/render3d/people/rig.js';
import { CLIPS, CLIP_NAMES, CLIP_INDEX, poseAt, bakeClips, clipFrames, FRAME_FLOATS, ROW, BEAT, WINDLASS } from '../src/render3d/people/clips.js';
import { buildPiece } from '../src/render3d/people/pieces.js';
import { pack, cast, actorBounds, hash01, routePose } from '../src/render3d/people/actors.js';
import { AEDES } from '../src/render3d/models/aedes.js';
import { TEMPLUM } from '../src/render3d/models/templum.js';
import { peopleMaterial, peopleDepthMaterial, patchPeopleShader } from '../src/render3d/people/material.js';
import { MODELS, modelMatrix, TILE_M } from '../src/render3d/models.js';
import { ModelPass, peopleLodFor } from '../src/render3d/modelPass.js';
import { BUILDINGS } from '../src/data/buildings.js';

test('people3d: the rig has its 25 bones, each after its parent, and a prop bone in each hand', () => {
  assert.equal(BONE_COUNT, 25);
  assert.equal(new Set(BONES.map((b) => b.name)).size, BONE_COUNT);
  BONES.forEach((b, i) => assert.ok(b.parent < i, `${b.name} after its parent`));
  assert.equal(BONES[BONE.propL].parent, BONE.handL);
  assert.equal(BONES[BONE.propR].parent, BONE.handR);
  // A man of 1.70: the head's joint under the crown, the feet's over the soles.
  assert.ok(BONES[BONE.head].at[1] > 1.45 && BONES[BONE.footL].at[1] < 0.1);
});

test('people3d: every clip loops seamlessly, is baked as its poses, and plants its feet', () => {
  const baked = bakeClips();
  assert.equal(baked.table.length, CLIP_NAMES.length);
  // (The texture's rows within 8,192: every desktop and laptop GPU of the targets reads textures 16,384
  // tall or more, and the texture is only as tall as its rows, so the limit costs nothing until it is used.)
  assert.ok(baked.rows <= 8192, `${baked.rows} rows`);
  for (const name of CLIP_NAMES) {
    // The pose at the loop's end is the one at its start.
    const a = poseAt(name, 0);
    const b = poseAt(name, 1 - 1e-7);
    let d = 0;
    for (let i = 0; i < BONE_COUNT; i++) for (let k = 0; k < 16; k++) d = Math.max(d, Math.abs(a.world[i].elements[k] - b.world[i].elements[k]));
    assert.ok(d < 2e-3, `${name}: its loop's seam moves ${d}`);
    // Baked: row f is the pose at f / frames.
    const c = baked.table[CLIP_INDEX[name]];
    assert.equal(c.frames, clipFrames(name));
    const f = Math.floor(c.frames / 3);
    const want = poseAt(name, f / c.frames).write(new Float32Array(FRAME_FLOATS));
    const got = baked.data.subarray((c.start + f) * FRAME_FLOATS, (c.start + f + 1) * FRAME_FLOATS);
    for (let i = 0; i < FRAME_FLOATS; i++) assert.ok(Math.abs(want[i] - got[i]) < 1e-5, `${name} frame ${f}`);
    for (let i = c.start * FRAME_FLOATS; i < (c.start + c.frames) * FRAME_FLOATS; i++) assert.ok(Number.isFinite(baked.data[i]), name);
    // Every foot given a place reaches it; no toe under the ground.
    for (let k = 0; k < 12; k++) {
      const p = poseAt(name, k / 12);
      for (const [j, s] of [[0, 'L'], [1, 'R']]) {
        if (p.feet[j]) assert.ok(p.jointOf(`foot${s}`).distanceTo(new Vector3(...p.feet[j].at)) < 1e-3, `${name}: foot ${s}`);
        assert.ok(p.jointOf(`toe${s}`).y > 0, `${name}: toe ${s} above the ground`);
      }
    }
  }
  // Each clip has a loop at least a second long (but the walks), and a toga variant where it says so.
  for (const [n, c] of Object.entries(CLIPS)) {
    if (c.toga) assert.ok(`${n}@toga` in CLIP_INDEX, n);
    assert.ok(c.walk || c.dur >= 1.2, n);
  }
});

/** Every piece the actors can name. */
const PIECES = [
  'body:m', 'body:f', 'body:c', 'tunic:m:knee', 'tunic:m:short', 'tunic:m:long', 'tunic:m:knee:broad', 'tunic:f:long:stola', 'tunic:c:knee',
  'toga:m', 'toga:m:velato', 'pallium:m', 'palla:f', 'palla:f:veil', 'paenula:m', 'lorica:m', 'limus:m', 'caligae:m', 'helmet:m', 'bulla:c', 'wreath:m',
  'hair:crop:m', 'hair:curls:m', 'hair:bun:f', 'hair:bald:m', 'beard:full:m', 'beard:short:m',
  ...['patera', 'tibiae', 'tablet', 'stylus', 'rollOpen', 'roll', 'spear', 'scutum', 'broom', 'purse', 'axe', 'fasces', 'acerra', 'hammer', 'chisel', 'coin', 'beam', 'sack', 'oar', 'gladius', 'razor', 'pestle', 'cup', 'bow', 'arrow', 'crank', 'shears'].flatMap((p) => [`prop:${p}:R`, `prop:${p}:L`]),
];
const tris = (key, lod) => buildPiece(key, lod).index.count / 3;

test('people3d: every piece at every level is skinned to the rig, its weights summing to 1, each level lighter', () => {
  for (const key of PIECES) {
    let last = Infinity;
    for (const lod of [0, 1, 2]) {
      const g = buildPiece(key, lod);
      const w = g.attributes.aWeights.array;
      const b = g.attributes.aBones.array;
      for (let i = 0; i < w.length; i += 4) {
        assert.ok(Math.abs(w[i] + w[i + 1] + w[i + 2] + w[i + 3] - 1) < 1e-5, `${key}@${lod}: weights at ${i / 4}`);
        for (let k = 0; k < 4; k++) assert.ok(b[i + k] < BONE_COUNT && w[i + k] >= 0, `${key}@${lod}`);
      }
      for (const n of g.attributes.normal.array) assert.ok(Number.isFinite(n), `${key}@${lod}: a normal`);
      const t = g.index.count / 3;
      assert.ok(t > 0 && t <= last, `${key}: level ${lod} (${t}) no heavier than the one before (${last})`);
      last = t;
    }
  }
  // A citizen (body, tunic, hair) and a senator (with his toga) within the levels' budgets.
  const person = (keys, lod) => keys.reduce((n, k) => n + tris(k, lod), 0);
  const citizen = ['body:m', 'tunic:m:knee', 'hair:crop:m'];
  const senator = ['body:m', 'tunic:m:knee:broad', 'toga:m', 'hair:crop:m'];
  assert.ok(person(citizen, 0) <= 6000 && person(senator, 0) <= 7500, `${person(citizen, 0)} / ${person(senator, 0)}`);
  assert.ok(person(citizen, 1) <= 1500 && person(senator, 1) <= 1900, `${person(citizen, 1)} / ${person(senator, 1)}`);
  assert.ok(person(citizen, 2) <= 400 && person(senator, 2) <= 520, `${person(citizen, 2)} / ${person(senator, 2)}`);
});

test('people3d: the shader patch finds every line it changes, for the people and their shadows', () => {
  const shader = (lib) => ({ uniforms: {}, vertexShader: ShaderLib[lib].vertexShader, fragmentShader: ShaderLib[lib].fragmentShader });
  const s = shader('physical');
  // The look's own patch first (materials.js patchLook), then the people's, as the material does.
  peopleMaterial().onBeforeCompile(s, null);
  assert.match(s.vertexShader, /peopleSkin\(/);
  assert.match(s.fragmentShader, /uLookSnowMul \* vPeopleMat\.w/);
  assert.match(s.fragmentShader, /vPeopleWet/);
  for (const [lib, kind] of [['depth', 'depth'], ['distance', 'distance']]) {
    const d = shader(lib);
    peopleDepthMaterial(kind).onBeforeCompile(d, null);
    assert.match(d.vertexShader, /pSkin \* vec4\( pRest, 1\.0 \)/);
  }
  assert.throws(() => patchPeopleShader({ uniforms: {}, vertexShader: 'void main() {}', fragmentShader: '' }, true), /not found/);
});

test('people3d: actors pack their pieces, clips, colours and routes as specified', () => {
  const a = pack({ body: 'f', dress: ['tunic:long:stola', 'palla:veil'], hair: 'bun', props: { R: 'patera' }, clip: 'pray', at: [1, 0, 2], ry: 0.5, seed: 3 });
  assert.deepEqual([...a.pieces], ['body:f', 'tunic:f:long:stola', 'palla:f:veil', 'hair:bun:f', 'prop:patera:R']);
  assert.equal(a.clip[0], CLIP_INDEX.pray);
  // A toga wearer plays his clip's toga variant (the folds on his left arm); a clip without one as it is.
  assert.equal(pack({ dress: ['toga'], clip: 'talk' }).clipName, 'talk@toga');
  assert.equal(pack({ dress: ['toga'], clip: 'pray' }).clipName, 'pray');
  assert.throws(() => pack({ clip: 'juggle' }), /No clip/);
  assert.throws(() => pack({ dress: ['trousers'] }), /No garment/);
  // Stable: the same spec, the same colours and phase (no randomness: the same after a reload).
  const b = pack({ body: 'f', dress: ['tunic:long:stola', 'palla:veil'], hair: 'bun', props: { R: 'patera' }, clip: 'pray', at: [1, 0, 2], ry: 0.5, seed: 3 });
  assert.deepEqual([...a.col0, ...a.col1, a.clip[1]], [...b.col0, ...b.col1, b.clip[1]]);
  assert.equal(hash01(1, 2), hash01(1, 2));
  // A child: smaller, its head scaled up by the shader.
  const c = pack({ body: 'c' });
  assert.ok(c.scale < 0.85 && c.misc[0] > 1);
  // A route: its length and speed, its ends' clips, their facings in the actor's frame.
  const r = pack({ clip: 'walk', ry: Math.PI / 2, route: { length: 2, speed: 0.8, clipEnd: 'sacrifice', clipStart: 'pray', faceEnd: Math.PI, faceStart: 0 } });
  assert.deepEqual([...r.route.slice(0, 2)], [2, Math.fround(0.8)]);
  assert.equal(r.clip[3], CLIP_INDEX.sacrifice + 64 * CLIP_INDEX.pray);
  assert.ok(Math.abs(r.misc[1] - Math.PI / 2) < 1e-6, 'faces the end\'s way: a quarter turn from its walk');
  assert.ok(r.misc[2] > 0 && r.misc[2] <= 2 * Math.PI);
});

/** The converted buildings: a building of each, in each state, through the game's own entries. */
const CONVERTED = {
  temple_ceres: [{ efficiency: 1 }, { efficiency: 1, fest: true }, { efficiency: 0 }],
  temple_large_mars: [{ efficiency: 1 }, { efficiency: 1, fest: true }, { efficiency: 0 }],
  oracle: [{}],
  mission_post: [{ efficiency: 1 }, { efficiency: 0 }],
  school: [{ efficiency: 1 }, { efficiency: 0 }],
  library: [{ efficiency: 1 }, { efficiency: 0 }],
  academy: [{ efficiency: 1 }, { efficiency: 0 }],
  forum: [{ efficiency: 1 }, { efficiency: 0 }],
  senate: [{ efficiency: 1 }, { efficiency: 1, alarm: true }, { efficiency: 0 }],
  prefecture: [{ efficiency: 1 }, { efficiency: 1, fire: true }, { efficiency: 0 }],
};

/** A building of `type` in a state, and the game its variant reads. */
function scene(type, s) {
  const god = BUILDINGS[type].god;
  const b = { id: 7, type, x: 10, y: 10, size: BUILDINGS[type].size, efficiency: s.efficiency ?? 1 };
  const game = {
    city: { gods: god ? { [god]: { festivalsHeld: s.fest ? 1 : 0, monthsSinceFestival: s.fest ? 0 : 2, angered: false } } : {} },
    time: { totalTicks: 1 },
    walkers: new Map(s.fire ? [[1, { type: 'prefect', home: b.id, origin: b.id, state: 'toFire' }]] : s.alarm ? [[1, { type: 'rioter', target: b.id }]] : []),
    units: new Map(),
    buildings: new Map([[b.id, b]]),
  };
  return { b, game };
}

test('people3d: every converted building keeps its people on its own footprint at every view turn', () => {
  const m = new Matrix4();
  const a = new Matrix4();
  const p = new Vector3();
  for (const [type, states] of Object.entries(CONVERTED)) {
    for (const s of states) {
      const { b, game } = scene(type, s);
      const v = MODELS[type].variant(b, { snow: 0 }, { game });
      if (s.efficiency === 0 && type !== 'oracle') assert.equal(v.actors.actors.length, 0, `${type}: nobody unstaffed`);
      else assert.ok(v.actors.actors.length > 0, `${type} ${JSON.stringify(s)}: people`);
      const S = b.size;
      for (let T = 0; T < 4; T++) {
        modelMatrix(0, 0, S, T, 0, m);
        for (const act of v.actors.actors) {
          for (const c of actorBounds(act, 0.3)) {
            // The body's reach round each point (its shoulders): the footprint's square, a tile is TILE_M.
            for (const [dx, dz] of [[c.r, 0], [-c.r, 0], [0, c.r], [0, -c.r]]) {
              p.set(c.x + dx, 0, c.z + dz).applyMatrix4(m);
              assert.ok(p.x >= -1e-6 && p.x <= S + 1e-6 && p.z >= -1e-6 && p.z <= S + 1e-6, `${type} turn ${T}: an actor at ${c.x.toFixed(2)}, ${c.z.toFixed(2)} off the footprint`);
            }
          }
          // Its instance matrix (the batch's) puts its feet where its spec says.
          p.set(0, 0, 0).applyMatrix4(a.fromArray(act.local));
          assert.ok(Math.abs(p.x - act.at[0]) < 1e-6 && Math.abs(p.z - act.at[2]) < 1e-6);
        }
      }
    }
  }
  void TILE_M;
});

test('people3d: the model pass draws the actors of the buildings it draws, written again only when the set changes', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const { b, game } = scene('forum', { efficiency: 1 });
  const r = { game, weather: {}, time: 0, camera: { scale: 4 } };
  const placed = (T = 0) => [{ b, T, vx: b.x, vy: b.y, state: 0, snow: 0 }];
  const frame = (list) => { for (let i = 0; i < 4; i++) mp.update(r, list, 2); };
  frame(placed());
  const want = MODELS.forum.variant(b).actors.actors.length;
  assert.equal(mp.stats.people, want, 'the forum\'s people drawn');
  assert.equal(mp.people.lod, peopleLodFor(4));
  // Instanced: each piece one mesh, its count the people wearing it.
  const bodies = [...mp.people.pieces.values()].filter((q) => q.key === 'body:m' && q.lod === mp.people.lod).reduce((n, q) => n + q.mesh.count, 0);
  assert.equal(bodies, want);
  // A still view writes nothing more.
  const writes = mp.people.stats.writes;
  frame(placed());
  assert.equal(mp.people.stats.writes, writes, 'nothing written for the same set');
  // The view turned: written again; the forum shut: nobody; not drawn at all: nobody.
  mp.update(r, placed(1), 2);
  assert.ok(mp.people.stats.writes > writes, 'a turn writes them again');
  b.efficiency = 0;
  frame(placed(1));
  assert.equal(mp.stats.people, 0, 'nobody at a shut forum');
  b.efficiency = 1;
  frame([]);
  assert.equal(mp.stats.people, 0, 'nobody for a building not drawn');
  assert.ok([...mp.people.pieces.values()].every((q) => q.mesh.count === 0 || !q.mesh.visible));
  mp.dispose();
});

test('people3d: the people\'s level of detail follows a tile\'s size on the screen', () => {
  // Pixel ratio 2: zoom 1 far, 2 the middle, 3 and closer the full body.
  assert.equal(peopleLodFor(2), 2);
  assert.equal(peopleLodFor(4), 1);
  assert.equal(peopleLodFor(6), 0);
  assert.equal(peopleLodFor(12), 0);
  // A cast is packed once: the same object for every building of a state.
  const { b, game } = scene('senate', { efficiency: 1 });
  assert.equal(MODELS.senate.variant(b, {}, { game }).actors, MODELS.senate.variant({ ...b, id: 9, x: 40 }, {}, { game }).actors);
  assert.equal(cast([]).actors.length, 0);
});

test('people3d: a route turns the short way, moves without a jump, and keeps the walk\'s clock running', () => {
  const casts = [];
  for (const [type, states] of Object.entries(CONVERTED)) {
    for (const s of states) {
      const { b, game } = scene(type, s);
      casts.push([type, MODELS[type].variant(b, { snow: 0 }, { game }).actors]);
    }
  }
  const walkers = casts.flatMap(([type, c]) => c.actors.filter((a) => a.routeLength > 0).map((a) => [type, a]));
  assert.ok(walkers.length >= 4, 'the converted buildings have walkers');
  const angle = (x, y) => Math.abs(Math.atan2(Math.sin(x - y), Math.cos(x - y)));
  for (const [type, a] of walkers) {
    const rate = 1.1;
    const dt = 0.005;
    let last = routePose(a, 0, rate);
    let turned = 0;
    for (let t = dt; t < 60; t += dt) {
      const p = routePose(a, t, rate);
      assert.ok(angle(p.yaw, last.yaw) < 0.06, `${type}: its facing jumps at ${t.toFixed(2)}`);
      assert.ok(Math.abs(p.adv - last.adv) <= a.route[1] * dt + 1e-6, `${type}: it jumps along its way at ${t.toFixed(2)}`);
      // The walk's clock: continuous from a turn into the walk back (no fade there); across the loop's
      // wrap the new walk fades in from the turn's (its prevT continues the turn's clock).
      if (last.seg === 3 && p.seg === 4) assert.ok(Math.abs(p.clipT - last.clipT - dt * rate) < 1e-6, `${type}: the walk back starts where the turn's left off`);
      if (last.seg === 6 && p.seg === 1) assert.ok(Math.abs(p.prevT - last.clipT - dt * rate) < 1e-3 && p.since < 0.35, `${type}: the wrap fades from the turn's walk`);
      if (p.seg === 3 || p.seg === 6) turned += angle(p.yaw, last.yaw);
      if ((last.seg === 3 && p.seg === 4) || (last.seg === 6 && p.seg === 1)) {
        assert.ok(turned <= Math.PI + 1e-3, `${type}: a turn of ${turned.toFixed(2)} rad, more than half a circle`);
        turned = 0;
      }
      last = p;
    }
  }
});

test('people3d: the temples\' priests walk clear of their altars and the altar\'s step', () => {
  for (const type of ['temple_ceres', 'temple_large_mars']) {
    const { b, game } = scene(type, { efficiency: 1 });
    const M = type === 'temple_ceres' ? AEDES : TEMPLUM;
    const [ax, az, aw, ad] = M.altar;
    const priest = MODELS[type].variant(b, { snow: 0 }, { game }).actors.actors.find((a) => a.routeLength > 0);
    assert.ok(priest, type);
    // (The altar's die and its step, 0.25 round it, and a man's half breadth.)
    const r = 0.25 + 0.15;
    for (let k = 0; k <= 20; k++) {
      const d = (priest.routeLength * k) / 20;
      const x = priest.at[0] + Math.sin(priest.ry) * d;
      const z = priest.at[2] + Math.cos(priest.ry) * d;
      assert.ok(Math.abs(x - ax) > aw / 2 + r - 1e-6 || Math.abs(z - az) > ad / 2 + r, `${type}: the priest's way at ${x.toFixed(2)}, ${z.toFixed(2)} crosses the altar`);
    }
  }
});

test('people3d: the working clips reach their tools: the oar through its thole, the mallet on the block, the crank round its axle, the bow drawn and loosed', () => {
  const near = (a, b, d, what) => assert.ok(a.distanceTo(b) < d, `${what}: ${a.toArray().map((v) => v.toFixed(3))} vs ${b.toArray().map((v) => v.toFixed(3))}`);
  for (let k = 0; k < 16; k++) {
    const t = k / 16;
    // The oar's line from its handle (propR) passes the thole pin, on each side; both hands on the loom.
    for (const [clip, so] of [['row', 1], ['rowRight', -1]]) {
      const p = poseAt(clip, t);
      const grip = p.jointOf('propR');
      const up = new Vector3(0, 1, 0).transformDirection(p.world[BONE.propR]);
      const thole = new Vector3(so * ROW.out, ROW.up, ROW.ahead);
      near(grip.clone().addScaledVector(up, thole.clone().sub(grip).dot(up)), thole, 1e-3, `${clip} at ${t}: the oar through its thole`);
      for (const h of ['handL', 'handR']) assert.ok(p.jointOf(h).distanceTo(grip) < 0.35, `${clip}: ${h} on the oar`);
    }
    // The crank on its axle; the hands on its handle as it goes round.
    const w = poseAt('windlass', t);
    const axle = w.jointOf('propR');
    near(axle, new Vector3(WINDLASS.x, WINDLASS.height, WINDLASS.ahead), 1e-6, 'the crank on its axle');
    const handle = axle.clone().add(new Vector3(0, 1, 0).transformDirection(w.world[BONE.propR]).multiplyScalar(WINDLASS.arm));
    for (const h of ['handL', 'handR']) assert.ok(Math.abs(w.jointOf(h).y + 0.01 - handle.y) < 0.03 && Math.abs(w.jointOf(h).z + 0.03 - handle.z) < 0.03, `windlass: ${h} on the handle at ${t}`);
  }
  // The mallet's head (props.js hammer: 0.22 along the grip's x, its face 0.05 under) comes down on the block at the catch.
  const b = poseAt('beat', 0);
  const head = b.jointOf('propR').add(new Vector3(0.22, -0.05, 0).applyMatrix4(new Matrix4().extractRotation(b.world[BONE.propR])));
  near(head, new Vector3(BEAT.side, BEAT.height, BEAT.ahead), 0.02, 'the mallet on the block');
  // The bow: drawn, the nock (propR) far back from the grip and the arrow shown; loosed, the arrow gone.
  const drawn = poseAt('shoot', 0.45);
  const loosed = poseAt('shoot', 0.7);
  const scale = (p) => new Vector3().setFromMatrixColumn(p.world[BONE.propR], 0).length();
  assert.ok(scale(drawn) > 0.99 && scale(loosed) < 0.01);
  assert.ok(drawn.jointOf('propR').distanceTo(drawn.jointOf('propL')) > 0.5, 'drawn to the jaw');
  // The string's nock is skinned to the drawing hand's prop bone.
  const bow = buildPiece('prop:bow:L', 0);
  const bones = bow.attributes.aBones.array;
  const wts = bow.attributes.aWeights.array;
  let nock = 0;
  for (let i = 0; i < bones.length; i += 4) if (bones[i] === BONE.propR && wts[i] === 1) nock++;
  assert.ok(nock > 0, 'the bow string\'s nock on propR');
});

test('people3d: actors in step (sync) share the building\'s phase and speed: a crew to its hortator\'s beat', () => {
  const crew = cast([{ clip: 'row', sync: true }, { clip: 'rowRight', sync: true, seed: 99 }, { clip: 'beat', sync: true }, { clip: 'idle' }]);
  assert.deepEqual(crew.actors.slice(0, 3).map((a) => a.clip[1]), [0, 0, 0]);
  assert.ok(crew.actors[3].clip[1] !== 0 && !crew.actors[3].sync);
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const batch = mp.people;
  batch.begin(0);
  batch.add(crew, new Matrix4(), 17);
  batch.end();
  const got = [];
  for (const p of batch.pieces.values()) {
    if (!p.key.startsWith('body:') || !p.mesh.count) continue;
    const a = p.attrs.aActClip.array;
    for (let i = 0; i < p.mesh.count; i++) got.push([a[i * 4], a[i * 4 + 1], a[i * 4 + 2]]);
  }
  const synced = got.filter(([c]) => c !== CLIP_INDEX.idle);
  assert.equal(synced.length, 3);
  for (const g of synced) assert.ok(g[1] === synced[0][1] && g[2] === synced[0][2], 'one phase, one speed');
  mp.dispose();
});
