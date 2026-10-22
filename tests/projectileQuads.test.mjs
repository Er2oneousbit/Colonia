import test from 'node:test';
import assert from 'node:assert/strict';
import { arrowCorners, firePotEllipses, stoneEllipse } from '../src/render3d/projectileQuads.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('an arrow flying along +x on the map points down-right on screen, head 4k ahead, tail 4.8k behind', () => {
  // vx = 1, vy = 0: screen direction (1, 0.5) normalised.
  const k = 2;
  const c = arrowCorners(100, 50, k, 1, 0);
  const len = Math.hypot(1, 0.5);
  const ux = 1 / len;
  const uy = 0.5 / len;
  // The head edge's midpoint and the tail edge's midpoint.
  const hx = (c[1][0] + c[3][0]) / 2;
  const hy = (c[1][1] + c[3][1]) / 2;
  const tx = (c[0][0] + c[2][0]) / 2;
  const ty = (c[0][1] + c[2][1]) / 2;
  near(hx, 100 + ux * 4 * k);
  near(hy, 50 + uy * 4 * k);
  near(tx, 100 - ux * 4.8 * k);
  near(ty, 50 - uy * 4.8 * k);
  // The quad is 1.6k wide, square to the flight.
  near(Math.hypot(c[0][0] - c[2][0], c[0][1] - c[2][1]), 1.6 * k);
  near((c[1][0] - c[0][0]) * (c[2][0] - c[0][0]) + (c[1][1] - c[0][1]) * (c[2][1] - c[0][1]), 0);
});

test('a standing projectile (no velocity) still gets a finite quad', () => {
  const c = arrowCorners(0, 0, 1, 0, 0);
  for (const p of c) assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]));
});

test('fire pot and stone ellipses match Classic sizes', () => {
  const e = firePotEllipses(10, 20, 2, 1, 0);
  assert.deepEqual(e.pot, { cx: 10, cy: 20, rx: 3.2, ry: 3.2 });
  near(e.flame.cx, 10 - 12);
  near(e.flame.cy, 20 - 3);
  assert.deepEqual(stoneEllipse(5, 6, 1), { cx: 5, cy: 6, rx: 1.3, ry: 1.3 });
});
