/**
 * models.js
 * ----------------------------------------------------------------------------
 * 3D models for buildings, drawn by the WebGL back end (webglBackend.js) in
 * place of their sprites. A building type without a model keeps its sprite,
 * so models can come one at a time.
 *
 *   MODELS[type] = (S, state, snow) => THREE.Object3D
 *
 * A model is built as its sprite's art is written (draw.js): facing turn 0,
 * in its footprint's own coordinates, x = u and z = v from 0 to S tiles, y
 * up in tiles, ART_PX tiles per px of the art's height (so a height read off
 * the sprite art, P(u, v, z), is z * ART_PX). The back end turns it with the
 * building's turn and the view's, stands it on its footprint and lights it
 * from the upper left as the sprites are shaded. `state` is the sprite's art
 * state (buildingArt.js artState: a home's level, a farm's growth...),
 * `snow` the snow cover level 0..3 (the sprites' `~n{level}`). A model is
 * built once per type, size, state and snow level and shared by every
 * building drawn with it, so it must not be changed after it is returned.
 *
 * Colors are the art's palette (buildingArt.js COL) as plain bytes: the back
 * end switches three.js's color management off, so '#a79f8f' shows as
 * '#a79f8f' on a wall in full light, as on a sprite. A flat ground plate
 * (paving, a yard) is drawn in its plain color by the art, but a flat top
 * gets the most sun (light.js TOP): give it `plate(color)`.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, BoxGeometry, CylinderGeometry, MeshLambertMaterial } from 'three';
import { COL } from '../render/buildingArt.js';
import { SNOW, mix, shade } from '../render/draw.js';
import { ART_PX, TILE_LEN } from './projection.js';
import { TOP } from './light.js';

/** A matte material in an art color. */
const matte = (color) => new MeshLambertMaterial({ color });

/** A flat ground plate's color, dimmed so the sun on it brings it back to the art's (see the header). */
const plate = (color) => shade(color, 1 / TOP - 1);

/** A color under snow cover level `snow` (0..3): `f` is how much of it settles there. */
const snowy = (color, snow, f) => (snow > 0 ? mix(color, SNOW, Math.min(1, (snow / 3) * f)) : color);

/** Screen px of the sprite art, across the screen, in 3D units (a ring 20 px wide on the sprite is 20 / TILE_LEN across). */
const across = (px) => px / TILE_LEN;

/**
 * The Puteus (well), after wellArt (buildingArt.js): a paved square, a stone
 * ring holding dark water, and a wooden frame of two posts and a crossbar
 * with a bucket on its rope. At turn 0 the frame runs across the screen as
 * on the sprite; turned, it turns (the sprite's frame stays put: the well is
 * drawn the same from every side, SAME_EVERY_WAY).
 */
function wellModel(S, state, snow) {
  const g = new Group();
  const c = S / 2;
  const add = (geo, mat, x, y, z, ry = 0) => {
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    g.add(m);
    return m;
  };
  // Paving, barely raised (the sprite's is flat on the ground).
  const pave = 0.6 * ART_PX;
  add(new BoxGeometry(0.7 * S, pave, 0.7 * S), matte(plate(snowy(COL.paving, snow, 0.8))), c, pave / 2, c);
  // The stone ring, 20 px across and 5 px high on the sprite; its rim takes the snow.
  const R = across(10);
  const ringH = 5 * ART_PX;
  const stone = matte(COL.stone);
  const ring = add(new CylinderGeometry(R, R, ringH, 28), [stone, matte(snowy(COL.stone, snow, 0.9)), stone], c, pave + ringH / 2, c);
  ring.name = 'ring';
  // Dark water inside the rim.
  add(new CylinderGeometry(across(7), across(7), 0.4 * ART_PX, 24), matte('#2c4a66'), c, pave + ringH + 0.2 * ART_PX, c);
  // The frame: posts 9 px either side of the middle across the screen (along
  // u - v, which is 45 degrees about the vertical), 12 px tall from the rim,
  // and a crossbar over them.
  const wood = matte(COL.woodDark);
  const post = across(1.6);
  const off = across(9) / Math.SQRT2; // along (1, 0, -1) / sqrt 2: so much in x, minus so much in z
  for (const s of [-1, 1]) {
    add(new BoxGeometry(post, 13 * ART_PX, post), wood, c + s * off, pave + (4 + 6.5) * ART_PX, c - s * off, Math.PI / 4);
  }
  const barTop = snowy(COL.woodDark, snow, 1);
  const bar = add(new BoxGeometry(across(19.6), 1.6 * ART_PX, post), [wood, wood, matte(barTop), wood, wood, wood], c, pave + 17.2 * ART_PX, c, Math.PI / 4);
  bar.name = 'crossbar';
  // The rope and the bucket hanging under the crossbar.
  add(new BoxGeometry(across(0.6), 2.6 * ART_PX, across(0.6)), matte('#4a3a2a'), c, pave + 15.1 * ART_PX, c, Math.PI / 4);
  add(new BoxGeometry(across(3), 3.5 * ART_PX, across(3)), matte('#8a6a44'), c, pave + 12 * ART_PX, c, Math.PI / 4);
  return g;
}

/** Building types drawn as 3D models by the WebGL back end (see the header). */
export const MODELS = Object.freeze({
  well: wellModel,
});

/** Does a building type have a 3D model? */
export function hasModel(type) {
  return Object.prototype.hasOwnProperty.call(MODELS, type);
}

/**
 * A building's own copy of a model, ready to be stood on its footprint:
 * an outer group turned about the footprint's middle, holding the model
 * moved so that middle is its origin. (A copy shares the model's geometry
 * and materials.)
 */
export function modelHolder(model, S) {
  const holder = new Group();
  const off = new Group();
  off.position.set(-S / 2, 0, -S / 2);
  off.add(model.clone());
  holder.add(off);
  return holder;
}

/**
 * Stand a holder (modelHolder) on an S x S footprint whose corner nearest
 * the top of the screen is view tile (vx, vy), turned T quarter turns as
 * render/turn.js turns art ((u, v) -> (S - v, u) each: a quarter turn
 * clockwise seen from above, which is minus a quarter about three.js's y),
 * and sunk `rise` px of art (a new building rising out of the ground, as
 * its sprite is drawn `rise` px lower: the ground quads hide what is under
 * the ground).
 */
export function standModel(holder, vx, vy, S, T, rise = 0) {
  holder.position.set(vx + S / 2, -rise * ART_PX, vy + S / 2);
  holder.rotation.set(0, (-(T & 3) * Math.PI) / 2, 0);
}

/** Free a model's geometries and materials (when no building uses its look any more). */
export function disposeModel(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
  });
}
