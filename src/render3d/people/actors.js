/**
 * people/actors.js
 * ----------------------------------------------------------------------------
 * The actors' API: how a model puts people in its building. A model (and
 * each of its states) declares its actors instead of merging people into
 * its kit (models.js: a variant's `actors`); the model pass hands the cast
 * of each building it draws to the people's batch (batch.js) with the
 * building's matrix, and the GPU moves them (material.js).
 *
 * An actor, in the model's metres (facing +z at ry 0, as the models are):
 *   at       [x, y, z]  where it stands (its feet; a seat's height is the
 *            clips' SEAT_H over them, so a sitter stands its feet that far
 *            under the seat's top)
 *   ry       its facing (0: +z, the street)
 *   body     'm' a man, 'f' a woman, 'c' a child; `scale` (a child 0.78)
 *   dress    garments by name ('tunic:knee', 'toga', 'toga:velato',
 *            'palla:veil', 'lorica', 'caligae', 'helmet', 'bulla', ...): the
 *            body's kind is added (pieces.js keys)
 *   hair     'crop' | 'curls' | 'bun' | 'bald' | null; beard 'full' | 'short'
 *   props    { R: 'patera', L: 'tablet' }: a hand's prop (props.js)
 *   clip     what it does (clips.js); a toga wearer plays the clip's toga
 *            variant where there is one
 *   phase, speed  its own offset (s) and rate; else from its seed
 *   route    { length, speed, pauseEnd, pauseStart, clipEnd, clipStart,
 *            faceEnd, faceStart }: walks `length` metres ahead (+z of its
 *            facing) and back, at `speed` m/s, pausing at each end doing
 *            that end's clip turned to face that end's way (a facing in the
 *            model's frame, as ry; by default the way it came)
 *   colours  { tunic, mantle, skin, hair, trim, leather, accent, metal }
 *            (sRGB hex; any not given from the palette by its seed)
 *   seed     a number: its colours and phase when not given
 *   sync     true: in step with the building's other sync actors (a crew
 *            rowing to its hortator's beat): the batch gives them the
 *            building's phase and speed alike, `phase` their own on top
 *
 * cast(list) packs a list once (frozen): what the batch copies into its
 * instance buffers. A model keeps its casts by state, as it keeps `more`.
 * ----------------------------------------------------------------------------
 */

import { Matrix4, Quaternion, Vector3 } from 'three';
import { CLIP_INDEX, CLIPS, WALK_SPEED, clipDef } from './clips.js';

// ---------------------------------------------------------------------------
// The palette: Roman dyes and the people's own colours
// ---------------------------------------------------------------------------

/**
 * Roman cloth (sRGB): wool undyed in its sheep's shades, bleached white,
 * and the dyes of the record: madder's reds, weld's yellow and saffron,
 * woad's blues, a green of woad over weld, walnut's brown, ochre, and the
 * purple of the murex for a senator's stripe and a magistrate's border.
 */
export const DYES = Object.freeze({
  undyed: 0xd6cab0, oatmeal: 0xbfae8e, fawn: 0x9a8668, brownWool: 0x6e604f,
  white: 0xece6d8, candida: 0xf4f0e6,
  madder: 0xa3352b, rose: 0xc0705e, oxblood: 0x7a2a24,
  weld: 0xcfae4c, saffron: 0xd59a32,
  woad: 0x3f5a85, sky: 0x8094ae, green: 0x5a6d3e, olive: 0x7c7a48,
  walnut: 0x6b4a32, ochre: 0xa8783e, grey: 0x7c776e, black: 0x37332f,
  purple: 0x4e1a3a, murex: 0x6a2248,
});

/** Everyday tunics: mostly undyed or cheaply dyed, a few bright. */
export const TUNICS = Object.freeze([DYES.undyed, DYES.oatmeal, DYES.fawn, DYES.white, DYES.madder, DYES.rose, DYES.ochre, DYES.woad, DYES.sky, DYES.green, DYES.walnut, DYES.weld, DYES.olive, DYES.brownWool]);
/** Women's stolae and pallae: richer. */
export const STOLAE = Object.freeze([DYES.white, DYES.saffron, DYES.sky, DYES.rose, DYES.green, DYES.weld, DYES.oatmeal, DYES.murex]);
export const PALLAE = Object.freeze([DYES.woad, DYES.madder, DYES.olive, DYES.oxblood, DYES.sky, DYES.walnut, DYES.saffron, DYES.green]);
/** Skin: the Mediterranean's range, a few fair (a Gaul) and dark (an Egyptian, a Numidian). */
export const SKINS = Object.freeze([0xc8956c, 0xb88560, 0xa87452, 0x9a6a4a, 0xd2a17a, 0x8c5e40, 0xdcb08c, 0x75492f, 0xbf8b62]);
/** Hair: black and dark brown most, some chestnut, auburn or fair. */
export const HAIRS = Object.freeze([0x1d1612, 0x2a1e16, 0x3a2a1c, 0x4a3424, 0x1d1612, 0x2a1e16, 0x6a4428, 0x7a3a20, 0x9a7a4a]);
export const GREY_HAIRS = Object.freeze([0x8a8478, 0xa8a296, 0xc8c2b6, 0x6e6860]);

/** A stable hash in [0, 1) of numbers (no Math.random: a person looks the same every frame and after a reload). */
export function hash01(...v) {
  let h = 0x9e3779b9;
  for (const x of v) {
    h ^= Math.floor(x * 1000) + 0x7f4a7c15;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

/** Pick from a list by a seed and a salt. */
export function pick(list, seed, salt = 0) {
  return list[Math.floor(hash01(seed, salt) * list.length) % list.length];
}

// ---------------------------------------------------------------------------
// Packing
// ---------------------------------------------------------------------------

const GARMENT = /^(tunic|toga|pallium|palla|paenula|lorica|limus|caligae|helmet|bulla|wreath)/;

/** The clip an actor plays, its toga variant if it wears a toga and the clip has one. */
function clipFor(name, toga) {
  if (toga && CLIPS[name] && CLIPS[name].toga) return `${name}@toga`;
  if (!(name in CLIP_INDEX)) throw new Error(`No clip ${name}`);
  return name;
}

let NEXT_ID = 1;

/** A number for every piece key named so far (the batch's index of its meshes). */
const PIECE_IDS = new Map();
export function pieceId(key) {
  let id = PIECE_IDS.get(key);
  if (id === undefined) {
    id = PIECE_IDS.size;
    PIECE_IDS.set(key, id);
  }
  return id;
}

/**
 * Pack an actor spec (see the header): { pieces, local, clip, route, col0,
 * col1, misc, index, at, ry, reach } (Float32Arrays where the batch copies).
 */
export function pack(spec, index = 0) {
  const seed = spec.seed ?? index * 7.3 + 1;
  const body = spec.body || 'm';
  const scale = spec.scale ?? (body === 'c' ? 0.78 : 1);
  const toga = (spec.dress || []).some((d) => d.startsWith('toga'));
  const wrapped = toga || (spec.dress || []).some((d) => d.startsWith('pallium'));
  const pieces = [`body:${body}`];
  for (const d of spec.dress || []) {
    const m = GARMENT.exec(d);
    if (!m) throw new Error(`No garment ${d}`);
    const [what, ...rest] = d.split(':');
    pieces.push([what, body, ...rest].join(':'));
  }
  if (spec.hair) pieces.push(`hair:${spec.hair}:${body}`);
  if (spec.beard) pieces.push(`beard:${spec.beard}:${body}`);
  for (const side of ['L', 'R']) if (spec.props && spec.props[side]) pieces.push(`prop:${spec.props[side]}:${side}`);
  const clipName = clipFor(spec.clip || 'idle', toga);
  const c = CLIP_INDEX[clipName];
  const def = clipDef(clipName).def;
  const local = new Matrix4().compose(new Vector3(...(spec.at || [0, 0, 0])), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), spec.ry || 0), new Vector3(scale, scale, scale));
  const col = spec.colours || {};
  const colour = (k, list, salt) => col[k] ?? pick(list, seed, salt);
  const tunicC = colour('tunic', TUNICS, 1);
  const cols = [
    tunicC,
    colour('mantle', body === 'f' ? PALLAE : [DYES.white, DYES.oatmeal, DYES.walnut, DYES.woad, DYES.fawn], 2),
    colour('skin', SKINS, 3),
    colour('hair', spec.old ? GREY_HAIRS : HAIRS, 4),
    // (No stripe to be seen unless given one: the trim takes the tunic's own colour.)
    col.trim ?? tunicC,
    colour('leather', [0x5a3a24, 0x6e4a2e, 0x4a3020, 0x7a5434], 5),
    // (A toga's border is the accent: the toga's own white unless given, a magistrate's purple.)
    col.accent ?? (wrapped ? col.mantle ?? DYES.candida : pick([DYES.madder, DYES.weld, DYES.woad, DYES.white, DYES.green], seed, 6)),
    colour('metal', [0x8a8c90, 0xb08848], 7),
  ];
  const route = spec.route;
  const r = new Float32Array(4);
  let pauses = 0;
  if (route && route.length > 0) {
    if (route.speed !== undefined && !(route.speed > 0)) throw new Error(`A route's speed must be over 0 (${route.speed})`);
    r[0] = route.length;
    r[1] = route.speed ?? WALK_SPEED * 0.85;
    r[2] = route.pauseEnd ?? 4;
    r[3] = route.pauseStart ?? 3;
    // (Two clips in one float, b + 64 a, as the shader reads them: an index past 63 would read as another clip.)
    const end = CLIP_INDEX[clipFor(route.clipEnd || 'idle', toga)];
    const start = CLIP_INDEX[clipFor(route.clipStart || 'idle', toga)];
    if (end > 63 || start > 63) throw new Error('A route\'s pause clip past index 63: widen the packing (aActClip.w)');
    pauses = end + 64 * start;
  }
  // The facings at the route's ends in the actor's own frame: the end's within a half turn of 0 (the
  // way it arrived), the start's within a half turn of pi (the way it came back).
  const wrap = (a, mid) => mid + (((((a - mid + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);
  const faceEnd = route && route.faceEnd !== undefined ? wrap(route.faceEnd - (spec.ry || 0), 0) : 0;
  const faceStart = route && route.faceStart !== undefined ? wrap(route.faceStart - (spec.ry || 0), Math.PI) : Math.PI;
  const phase = spec.phase ?? (spec.sync ? 0 : hash01(seed, 9) * def.dur * 3);
  const speed = spec.speed ?? 1;
  // (Head scale: a child's head is bigger for its body than a man's.)
  const head = body === 'c' ? 1.14 : 1;
  return Object.freeze({
    index,
    pieces: Object.freeze(pieces),
    // (Each piece's number: the batch finds its meshes by it, with no string made a frame.)
    pieceIds: new Int32Array(pieces.map(pieceId)),
    local: new Float32Array(local.elements),
    clip: new Float32Array([c, phase, speed, pauses]),
    route: r,
    col0: new Float32Array(cols.slice(0, 4)),
    col1: new Float32Array(cols.slice(4, 8)),
    misc: new Float32Array([head, faceEnd, faceStart, 0]),
    at: Object.freeze((spec.at || [0, 0, 0]).slice()),
    ry: spec.ry || 0,
    scale,
    routeLength: route ? route.length : 0,
    clipName,
    // (In step with the building's other `sync` actors: the batch gives them its phase and speed alike.)
    sync: !!spec.sync,
  });
}

/** A building's cast: its actors packed once, an id for the batch's signature. */
export function cast(list) {
  return Object.freeze({ id: NEXT_ID++, actors: Object.freeze(list.map((s, i) => pack(s, i))) });
}

/** An empty cast (a building with nobody at it). */
export const NOBODY = cast([]);

/**
 * The route's state at time t (s, the instance's own clock), as the vertex
 * shader works it out (material.js VERT_MAIN, kept in step with it: the
 * tests read this twin): how far along (adv), the turn (yaw), the clip
 * playing and its time, the clip faded from, and how long since the fade
 * began (`since`: under FADE the two are blended). `walkRate` the walk's
 * playback rate for this speed (the shader's `rate`).
 */
export function routePose(a, t, walkRate) {
  const TURN = 0.9;
  const [L, v, pb, pa] = a.route;
  const tw = L / v;
  const C = 2 * tw + pa + pb + 2 * TURN;
  const s = ((t % C) + C) % C;
  const fy = a.misc[1];
  const fs = a.misc[2];
  const ease = (k) => k * k * (3 - 2 * k);
  const mix = (x, y, k) => x + (y - x) * k;
  if (s < tw) return { seg: 1, adv: v * s, yaw: 0, clip: 'walk', clipT: s * walkRate, prevT: (s + C) * walkRate, since: s };
  if (s < tw + pb) return { seg: 2, adv: L, yaw: fy * ease(Math.min(1, (s - tw) / 0.35)), clip: 'end', since: s - tw };
  if (s < tw + pb + TURN) return { seg: 3, adv: L, yaw: mix(fy, fy >= 0 ? Math.PI : -Math.PI, ease((s - tw - pb) / TURN)), clip: 'walk', clipT: s * walkRate, since: s - tw - pb };
  if (s < 2 * tw + pb + TURN) return { seg: 4, adv: L - v * (s - tw - pb - TURN), yaw: Math.PI, clip: 'walk', clipT: s * walkRate, since: 1e3 };
  if (s < 2 * tw + pb + TURN + pa) return { seg: 5, adv: 0, yaw: mix(Math.PI, fs, ease(Math.min(1, (s - 2 * tw - pb - TURN) / 0.35))), clip: 'start', since: s - 2 * tw - pb - TURN };
  return { seg: 6, adv: 0, yaw: mix(fs, fs < Math.PI ? 0 : 2 * Math.PI, ease((s - 2 * tw - pb - TURN - pa) / TURN)), clip: 'walk', clipT: s * walkRate, since: s - 2 * tw - pb - TURN - pa };
}

/**
 * Where an actor may reach (the tests check every building keeps its people
 * on its footprint): its feet's place, its route's far end, each with a
 * radius for the shoulders and a reaching hand.
 */
export function actorBounds(a, reach = 0.5) {
  const pts = [[a.at[0], a.at[2]]];
  if (a.routeLength) pts.push([a.at[0] + Math.sin(a.ry) * a.routeLength * a.scale, a.at[2] + Math.cos(a.ry) * a.routeLength * a.scale]);
  return pts.map(([x, z]) => ({ x, z, r: reach * a.scale }));
}
