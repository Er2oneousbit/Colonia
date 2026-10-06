/**
 * labRural.js
 * ----------------------------------------------------------------------------
 * The look lab's countryside scenes, wired into the lab (lab.js) through one
 * object so the lab itself changes little: the Farms scene (labFarms.js:
 * the eight farms on the game's ground, H) and the Granary scene
 * (labGranary.js: from empty to full, U), their info panels, their own
 * buttons (the field's step, the farms' condition, a ranch's herd, the
 * level of detail), their labels, their light (a wider shadow box than the
 * well's), and the lantern at night.
 * ----------------------------------------------------------------------------
 */

import { Vector3 } from 'three';
import { buildFarmsScene, FARM_SCENE } from './labFarms.js';
import { buildGranaryScene } from './labGranary.js';

export const FARMS_INFO = `
<button class="close" type="button" aria-label="Close">Close</button>
<h2>The farms</h2>
<p>Every kind of Colonia's farms on the game's own ground, each field as its crop has grown. They share one farmhouse, built
as the agricultural writers (Cato, Varro, Columella) and the small farmsteads excavated round Pompeii show a working farm's core:
a long house of rough stone in lime mortar on a footing of bigger stones, dressed corners, a roof of <i>tegulae</i> and
<i>imbrices</i> with a smoke vent over the hearth, a loft for the grain with its door and ladder over the yard, and a little
shrine to the household gods (<i>lararium</i>) by the door.</p>
<ul>
<li><b>Wheat</b>: a round threshing floor of beaten clay edged with stones, the straw stack round its pole (biggest just after
the harvest), sheaves stooked when the field is ripe, the grain heaped and the threshing sledge (<i>tribulum</i>) after it.</li>
<li><b>Vegetables</b>: a wattle fence, a well with a sweep (Pliny's <i>tolleno</i>), a stone channel along the beds, baskets
of cabbages, onions, turnips and roots when they are ready.</li>
<li><b>Orchard</b>: rows of apple, pear and fig trees, bare in winter, in blossom in spring, fruit as they ripen, ladders and
baskets at the harvest; fruit drying on hurdles.</li>
<li><b>Olive grove</b>: old gnarled olives, silver under their leaves; the oil mill (<i>trapetum</i>, as Cato describes it)
under an open shed, jars for the oil, cloths under the trees at the harvest.</li>
<li><b>Vineyard</b>: vines on stakes and a pole (the <i>vinea jugata</i> Columella describes), grapes in late summer, a
treading vat and jars sunk to their rims in the yard as at the Villa Regina at Boscoreale.</li>
<li><b>Flax</b>: a retting pond, drying racks, stooks of pulled flax when it is ripe.</li>
<li><b>Pig farm</b>: a sty of rubble walls under a lean-to roof, a stone trough, the pigs rooting in the pen.</li>
<li><b>Horse ranch</b>: a stable block, a hay stack and a water trough, horses in the paddock by the size of the herd.</li>
</ul>
<p>Resting for the winter, the tools are put away and most animals stay in; with no workers, doors and shutters are shut and
weeds come in.</p>
<h3>Controls</h3>
<ul>
<li>Sown to Ripe: the field's step. Worked, Resting, Idle: the farms' state. Herd 2, 4, 8: the ranch's mares.</li>
<li>Detail 0, 1, 2 (L): the levels the game draws as you zoom out. [ and ]: the step before or after.</li>
<li>Spring, summer, autumn, winter; N: snow lying; T: rain. 1 to 4: day, golden hour, night, winter. M, G, Z: zooms; O: orbit.</li>
</ul>`;

export const GRANARY_INFO = `
<button class="close" type="button" aria-label="Close">Close</button>
<h2>The granary</h2>
<p>A public granary (<i>horreum</i>) in 12 metres, after Ostia's horrea (the Grandi Horrea, the Horrea Epagathiana), Rome's
Horrea Galbana and the frontier forts' granaries: a raised floor at a cart's height with vents under it to keep the grain dry,
a store of rubble with brick bonding courses, buttresses against the grain's push, narrow louvred slits high up for air, a
tiled roof, and round it a portico on timber posts where the goods wait to go in or out.</p>
<p>How full it is shows in the portico: twenty places, each a cart's load, filled in turn round all four sides, so every
side shows its share whichever way the view is turned. Sacks of wheat, baskets of vegetables and of fruit, hams on a rack
beside salting tubs, baskets of fish beside amphorae. A lantern hangs at the front door; with no workers the doors are shut.</p>
<h3>Controls</h3>
<ul>
<li>Detail 0, 1, 2 (L). N: snow lying; T: rain. 1 to 4: day, golden hour, night, winter. M, G, Z: zooms; O: orbit.</li>
</ul>`;

/** The half size of the sun's shadow box over each scene (metres): the well's is the lab's own. */
const SHADOW_BOX = { farms: 36, granary: 28 };

/**
 * Make the scenes and their controls. `lab` gives the lab's pieces:
 * { scene, look, groundTex, group (its button-group maker), el, app }.
 */
export function ruralScenes(lab) {
  const { scene, look, groundTex, group, el, app } = lab;
  const farms = buildFarmsScene(groundTex, 'high');
  const gran = buildGranaryScene(groundTex, 'high');
  for (const s of [farms, gran]) {
    s.group.visible = false;
    s.ground.group.visible = false;
    scene.add(s.group, s.ground.group);
  }
  // The lantern's glass glows at night (no light of its own: a light more would change every program).
  look.lamps.push({ on: 0, set(k) { this.on = k; for (const m of gran.panes) m.emissiveIntensity = k * 2.5; } });

  // Controls: the farms' step, state and herd; the level of detail for both.
  const stepBtns = group(FARM_SCENE.steps.map(([label], i) => [label, '', () => setFarms({ step: i })]));
  const condBtns = group([['Worked', '', () => setFarms({ cond: 'n' })], ['Resting', '', () => setFarms({ cond: 'r' })], ['Idle', '', () => setFarms({ cond: 'i' })]]);
  const herdBtns = group([2, 4, 8].map((h) => [`Herd ${h}`, '', () => setFarms({ herd: h })]));
  const lodBtns = group([0, 1, 2].map((n) => [`Detail ${n}`, n ? '' : 'L', () => setLod(n)]));
  const bars = { farms: [stepBtns, condBtns, herdBtns, lodBtns], granary: [lodBtns] };
  // Labels over each farm and granary.
  const labels = el('div', { class: 'cardlabels' });
  app.appendChild(labels);
  const tags = [
    ...farms.farms.map((f) => ({ scene: 'farms', at: () => f.holder.position, h: 4.6, el: el('div', { class: 'cardlabel' }, `<b>${f.name}</b><span></span>`), f })),
    ...gran.granaries.map((g) => ({ scene: 'granary', at: () => g.holder.position, h: 8.0, el: el('div', { class: 'cardlabel' }, `<b>${g.name}</b><span>${g.note}</span>`) })),
  ];
  for (const t of tags) labels.appendChild(t.el);
  let current = null;

  function setFarms(next) {
    farms.set(next);
    refresh();
  }
  function setLod(n) {
    if (current === 'granary') gran.setLod(n);
    else farms.setLod(n);
    refresh();
  }
  /** What each farm shows now, under its name. */
  function noteOf(f) {
    const l = f.look;
    const step = FARM_SCENE.steps[l.step][0].toLowerCase();
    const cond = l.cond === 'i' ? ', idle' : l.cond === 'r' ? ', resting' : '';
    if (l.kind === 'stable') return `${l.horses} horse${l.horses === 1 ? '' : 's'} out${cond}`;
    if (l.kind === 'sty') return `${step}: ${l.pigs} pigs${cond}`;
    return `${step}${cond}`;
  }
  function refresh() {
    const on = current;
    for (const list of Object.values(bars)) for (const b of list) b[0].parentElement.style.display = 'none';
    for (const b of bars[on] || []) b[0].parentElement.style.display = '';
    stepBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === farms.state.step)));
    condBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(['n', 'r', 'i'][i] === farms.state.cond)));
    herdBtns.forEach((b, i) => b.setAttribute('aria-pressed', String([2, 4, 8][i] === farms.state.herd)));
    const lod = on === 'granary' ? gran.lod : farms.state.lod;
    lodBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === lod)));
    labels.style.display = on ? '' : 'none';
    for (const t of tags) if (t.f) t.el.querySelector('span').textContent = noteOf(t.f);
  }
  const lp = new Vector3();
  return {
    names: ['farms', 'granary'],
    info: { farms: FARMS_INFO, granary: GRANARY_INFO },
    farms,
    gran,
    /** What compiles after the first frame (the lab's warm-up `later`). */
    later: [farms.group, farms.ground.group, gran.group, gran.ground.group],
    grounds: [farms.ground, gran.ground],
    /** Show scene `name` (or none of these), its light fitted to it. */
    show(name) {
      current = name === 'farms' || name === 'granary' ? name : null;
      farms.group.visible = farms.ground.group.visible = current === 'farms';
      gran.group.visible = gran.ground.group.visible = current === 'granary';
      const box = SHADOW_BOX[current] || lab.shadowBox;
      const sc = look.sun.shadow.camera;
      sc.left = -box;
      sc.right = box;
      sc.top = box;
      sc.bottom = -box;
      sc.far = Math.max(80, box * 2.5);
      sc.updateProjectionMatrix();
      refresh();
    },
    /** The world's fade square for a scene, or null for not ours. */
    fade(name) {
      if (name === 'farms') return [0, 0, 40, 46];
      if (name === 'granary') return [0, 0, 54, 60];
      return null;
    },
    season(name) {
      farms.set({ season: name });
      refresh();
    },
    /** A key the scenes take ('l' the level of detail, '[' and ']' the step); true if taken. */
    key(k) {
      if (!current) return false;
      if (k === 'l') setLod(((current === 'granary' ? gran.lod : farms.state.lod) + 1) % 3);
      else if (current === 'farms' && (k === '[' || k === ']')) setFarms({ step: (farms.state.step + (k === ']' ? 1 : 4)) % 5 });
      else return false;
      return true;
    },
    life(t) {
      if (current === 'farms') farms.life(t);
    },
    /** Keep each label over its farm or granary. */
    placeLabels(cam, w, h, compact) {
      labels.classList.toggle('compact', compact);
      for (const t of tags) {
        const on = t.scene === current;
        if (!on) { t.el.style.display = 'none'; continue; }
        lp.copy(t.at()).add({ x: 0, y: t.h, z: 0 }).project(cam);
        const vis = lp.z < 1 && Math.abs(lp.x) < 1.05 && Math.abs(lp.y) < 1.05;
        t.el.style.display = vis ? '' : 'none';
        if (vis) t.el.style.transform = `translate(${((lp.x + 1) / 2) * w}px, ${((1 - lp.y) / 2) * h}px) translate(-50%, -100%)`;
      }
    },
    refresh,
    setFarms,
    setLod,
  };
}
