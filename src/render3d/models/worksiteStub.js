/**
 * models/worksiteStub.js (TEMPORARY: delete once models/worksite.js lands)
 * ----------------------------------------------------------------------------
 * Plain boxes standing in for the shared construction-site dressing
 * (worksite.js siteParts) so the civic monuments' stages show in the lab
 * meanwhile: scaffolds as poles and boards, cranes as a mast and a jib,
 * centering as a stepped arch, piles as stacks.
 * ----------------------------------------------------------------------------
 */

import { material } from '../materials.js';
import { box } from './civicParts.js';

const COLOURS = { marble: 0xf0ece4, timber: 0x8a5a33, clay: 0xb0643e, iron: 0x6a6a70, stone: 0xc8bea6 };

export function siteParts(site, lod = 0) {
  const wood = [];
  const piles = [];
  for (const s of site.scaffolds || []) {
    const g = [box(0.08, s.h, 0.08, -s.w / 2, 0, -s.d / 2), box(0.08, s.h, 0.08, s.w / 2, 0, -s.d / 2), box(0.08, s.h, 0.08, -s.w / 2, 0, s.d / 2), box(0.08, s.h, 0.08, s.w / 2, 0, s.d / 2)];
    for (let y = 1.4; y < s.h; y += 1.4) g.push(box(s.w, 0.05, s.d, 0, y, 0, 0.8));
    for (const q of g) wood.push(q.rotateY(s.ry || 0).translate(s.x, 0, s.z));
  }
  for (const c of site.cranes || []) {
    const g = [box(0.18, c.h, 0.18, 0, 0, 0), box(0.12, 0.12, c.h * 0.6, 0, c.h - 0.2, c.h * 0.25)];
    for (const q of g) wood.push(q.rotateY(c.ry || 0).translate(c.x, 0, c.z));
  }
  for (const c of site.centering || []) {
    if (c.dome) {
      wood.push(box(c.dome * 1.6, 0.1, c.dome * 1.6, c.x, c.y || 0, c.z, 0.7));
      continue;
    }
    for (let k = 0; k < 5; k++) {
      const a = (k / 4) * Math.PI;
      const g = box(0.2, 0.12, c.depth, Math.cos(a) * c.span / 2, (c.y || 0) + Math.sin(a) * c.rise, 0, 0.7);
      wood.push(g.rotateY(c.ry || 0).translate(c.x, 0, c.z));
    }
  }
  for (const pl of site.piles || []) {
    const n = Math.max(1, Math.min(4, pl.n || 2));
    for (let k = 0; k < n; k++) piles.push(box(0.9, 0.3, 0.6, 0, k * 0.3, 0, () => 1).rotateY(pl.ry || 0).translate(pl.x, 0, pl.z));
  }
  void lod;
  return [
    { name: 'scaffold', mat: material('stub-site-wood', { surface: 'wood', vertexColors: true, snow: 1 }), geos: wood },
    { name: 'piles', mat: material('stub-site-pile', { color: COLOURS.clay, roughness: 0.9, vertexColors: true, snow: 1 }), geos: piles },
  ];
}
