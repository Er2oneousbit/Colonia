/**
 * light.js
 * ----------------------------------------------------------------------------
 * The light on 3D models, matched to the sprites' shading (draw.js box():
 * light from the upper left, a box's top lightened 18%, its +v face, lower
 * left on the screen, in its own color, its +u face, lower right, 20%
 * darker). Models are lit by an ambient light plus a sun:
 *     brightness = AMBIENT + SUN * cos(angle to the sun)
 * solved for a top x1.15, a +v face x1.0 and a +u face x0.8 of a color. The
 * sun stays where it is on the screen whatever the view turn, as the
 * sprites' does: the 3D world is the view's tiles (projection.js).
 * ----------------------------------------------------------------------------
 */

export const AMBIENT = 0.55;
export const SUN = 0.79;
/** Toward the sun (x = u, y up, z = v), unit length. */
export const SUN_DIR = (() => {
  const d = [0.25, 0.6, 0.45];
  const l = Math.hypot(...d);
  return Object.freeze(d.map((c) => c / l));
})();
/** How bright a flat top in full sun comes out (x1.15): the art's ground plates are not lightened, so models dim theirs by it. */
export const TOP = AMBIENT + SUN * SUN_DIR[1];
