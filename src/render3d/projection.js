/**
 * projection.js
 * ----------------------------------------------------------------------------
 * The 2D renderer's isometric projection as a real 3D camera, so the WebGL
 * back end can draw sprites and 3D models in one picture.
 *
 * The art's projection (render/camera.js, draw.js): a point (u, v) of the
 * view's tiles, z px up, is at world px
 *     X = (u - v) * HALF_W,   Y = (u + v) * HALF_H - z.
 * That is an orthographic camera turned 45 degrees about the vertical and
 * looking down at the angle whose sine is HALF_H / HALF_W (30 degrees for the
 * game's 64 x 32 tiles). The 3D world here is the VIEW's tiles: x = u, z = v,
 * y up, one unit a tile; so a view turn needs no camera move, only the map
 * read through view.js, as the 2D renderer does.
 *
 *   TILE_LEN  world px along the screen per 3D unit (a tile's diagonal / 2)
 *   ART_PX    3D units of height per px of art height
 *
 * Depth. Where sprites and models overlap, which is in front is decided per
 * pixel by the depth buffer, in one measure for both, D (in tiles):
 *     D = u + v + z * KAPPA
 * the 2D renderer's depth (the view's x + y) for a point on the ground, a
 * little nearer the higher it is (KAPPA = 1/48 a px for the game's tiles).
 * A model's points get it from the camera. A sprite of the sorted objects
 * (a building strip, a walker) stands up like a cardboard cutout on the
 * ground line of its depth `d` (where the 2D renderer sorts it), so each of
 * its pixels gets the D of that upright plane (standDepth); ground sprites
 * lie on the ground (groundDepth). See render3d/webglBackend.js for how the
 * depth is used.
 * ----------------------------------------------------------------------------
 */

import { HALF_W, HALF_H } from '../config.js';

/** Sine and cosine of the angle the camera looks down at. */
const SIN = HALF_H / HALF_W;
const COS = Math.sqrt(1 - SIN * SIN);

/** World px along the screen per 3D unit. */
export const TILE_LEN = HALF_W * Math.SQRT2;
/** 3D units of height per px of art height (draw.js P(u, v, z)'s z). */
export const ART_PX = 1 / (TILE_LEN * COS);
/** Depth D (tiles) gained per px of height. */
export const KAPPA = HALF_H / (HALF_W * HALF_W - HALF_H * HALF_H);
/** The camera's backward direction (toward the viewer) in the 3D world (x = u, y up, z = v). */
export const BACK = Object.freeze([COS / Math.SQRT2, SIN, COS / Math.SQRT2]);
/** 3D distance along BACK per unit of D. */
const D_LEN = COS / Math.SQRT2;

/** D of the ground point seen at world px row Y. */
export function groundDepth(Y) {
  return Y / HALF_H;
}

/** D of the point seen at world px row Y on an upright cutout standing on the ground line of depth d. */
export function standDepth(d, Y) {
  return d + (d * HALF_H - Y) * KAPPA;
}

/** D of a 3D point (x = u, y up in 3D units, z = v). */
export function depthOf(x, y, z) {
  return x + z + (y / ART_PX) * KAPPA;
}

/** World px [X, Y] of a 3D point (x = u, y up in 3D units, z = v). */
export function worldPxOf(x, y, z) {
  return [(x - z) * HALF_W, (x + z) * HALF_H - y / ART_PX];
}

/**
 * Aim an OrthographicCamera (three.js) so it frames exactly what the 2D
 * camera `cam` shows (render/camera.js: its world px rectangle at its scale),
 * with depths D from dMin to dMax in front of it.
 */
export function aimCamera(camera, cam, dMin, dMax) {
  const dist = D_LEN * (dMax + 10);
  camera.position.set(BACK[0] * dist, BACK[1] * dist, BACK[2] * dist);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  // Seen from there, a 3D point's camera x is its world X / TILE_LEN and its camera y is -Y / TILE_LEN.
  const vw = cam.viewW / cam.scale;
  const vh = cam.viewH / cam.scale;
  camera.left = cam.x / TILE_LEN;
  camera.right = (cam.x + vw) / TILE_LEN;
  camera.top = -cam.y / TILE_LEN;
  camera.bottom = -(cam.y + vh) / TILE_LEN;
  camera.near = dist - D_LEN * dMax;
  camera.far = dist - D_LEN * dMin;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}
