/**
 * canvasBackend.js
 * ----------------------------------------------------------------------------
 * The Classic back end: draws what Renderer.render() collected straight onto
 * the 2D canvas, call for call as the renderer always did.
 *
 * A back end is told, in this order, every frame (render/items.js says what
 * an item is):
 *   begin()                  the frame starts (the camera has moved)
 *   ground(spr, wx, wy)      a ground sprite (terrain, shore, road, plaza, rubble)
 *   groundFill(wx, wy, c)    an overlay's tint over one tile
 *   groundLive(draw, box)    something drawn live on the ground (a sun glint):
 *                            draw(ctx) paints it in device px, inside `box`
 *   fill(pts, color)         a flat polygon on the ground (building shadows),
 *                            star-shaped from its last point
 *   model(b, place)          a building with a 3D model (never called here:
 *                            hasModel() says no)
 *   items(list)              the objects, sorted back to front
 *   present()                the scene is complete; what follows (particles,
 *                            the night, weather, signs, previews) is drawn on
 *                            the 2D canvas by the renderer itself
 * The WebGL back end (render3d/webglBackend.js) takes the same calls.
 * ----------------------------------------------------------------------------
 */

import { K_STRIP } from './items.js';

export class CanvasBackend {
  /** @param {import('./renderer.js').Renderer} r */
  constructor(r) {
    this.r = r;
    this.kind = '2d';
  }

  /** Always able to draw (the WebGL one is not while its context is lost). */
  get ready() { return true; }

  /** Buildings are always their sprites here. */
  hasModel() { return false; }

  begin() {}

  ground(spr, wx, wy) { this.r.blit(spr, wx, wy); }

  groundFill(wx, wy, color) { this.r.fillDiamond(wx, wy, color); }

  groundLive(draw) { draw(this.r.ctx); }

  fill(pts, color) {
    const ctx = this.r.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let q = 1; q < pts.length; q++) ctx.lineTo(pts[q][0], pts[q][1]);
    ctx.closePath();
    ctx.fill();
  }

  model() {}

  items(items) {
    const r = this.r;
    const ctx = r.ctx;
    for (const it of items) {
      if (it.kind !== K_STRIP) { r.drawLive(ctx, it); continue; }
      if (it.alpha) ctx.globalAlpha = it.alpha;
      if (it.full) r.blit(it.spr, it.wx, it.wy);
      else r.blitStrip(it.spr, it.wx, it.wy, it.j, it.n);
      if (it.alpha) ctx.globalAlpha = 1;
    }
  }

  present() {
    this.r.stats.models = 0;
  }

  dispose() {}
}
