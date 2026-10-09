/**
 * models/siteStub.js (temporary)
 * ----------------------------------------------------------------------------
 * A stand-in for the shared construction-site module (models/worksite.js
 * siteParts) until it lands: plain boxes for scaffolds, cranes, centering
 * and material piles, so the sacred monuments' stages render in the lab.
 * Deleted once worksite.js is on main.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, BoxGeometry, SphereGeometry } from 'three';
import { material } from '../materials.js';
import { boxUV, tintGeometry, merge } from '../shapes.js';

const COL = { marble: 0xece8e0, timber: 0x9a6a3a, clay: 0xb0643e, iron: 0x55565a, stone: 0xc8bea6 };

function bx(w, h, d, x, y, z, ry = 0) {
  const g = new BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return tintGeometry(boxUV(g));
}

/** The stand-in: one Group, a mesh a material, every mesh shown always. */
export function siteParts(site, lod = 0) {
  const wood = [];
  const goods = {};
  for (const s of site.scaffolds || []) {
    const { x, z, w, d, h, ry = 0 } = s;
    const c = Math.cos(ry);
    const sn = Math.sin(ry);
    for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) wood.push(bx(0.1, h, 0.1, x + px * c + pz * sn, 0, z - px * sn + pz * c));
    for (let y = 1.8; y < h; y += 1.8) wood.push(bx(w, 0.06, d, x, y, z, ry));
  }
  for (const k of site.cranes || []) {
    wood.push(bx(0.2, k.h, 0.2, k.x, 0, k.z, k.ry));
    wood.push(bx(0.12, 0.12, k.h * 0.7, k.x, k.h, k.z, k.ry));
  }
  for (const c of site.centering || []) {
    if (c.dome) wood.push(tintGeometry(boxUV(new SphereGeometry(c.dome, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(c.x, 0, c.z))));
    else wood.push(bx(c.span, c.rise, c.depth, c.x, 0, c.z, c.ry));
  }
  for (const p of site.piles || []) (goods[p.good] ??= []).push(bx(1.2, 0.25 * p.n + 0.1, 0.9, p.x, 0, p.z, p.ry));
  const g = new Group();
  if (wood.length) g.add(new Mesh(merge(wood), material('stub-timber', { color: COL.timber, roughness: 0.8, vertexColors: true })));
  for (const [good, list] of Object.entries(goods)) g.add(new Mesh(merge(list), material(`stub-${good}`, { color: COL[good] || 0xaaaaaa, roughness: 0.8, vertexColors: true })));
  for (const m of g.children) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.when = 'always';
  }
  void lod;
  return g;
}
