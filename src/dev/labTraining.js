/**
 * labTraining.js
 * ----------------------------------------------------------------------------
 * The look lab's Training scene (Shift+T): the training buildings of the
 * shows (render3d/models/grex.js, ludusGladiatorius.js, vivarium.js,
 * factio.js), each in a row of its states on beaten earth between streets,
 * labelled, as the game draws them (models/training.js: the states by the
 * parts' tags, the people and beasts the actors each model gives its state):
 *
 *   front row   training ('open'): the company rehearsing, the gladiators
 *               sparring, the keepers feeding the beasts, a team trotting
 *   middle row  staffed with a performer out on the road ('out'): the cart,
 *               the pair, the leopard and its cart, a team gone
 *   back row    no staff ('shut')
 *
 * Winter (the mood, or snow 2 and up) is the game's hard frost: the troughs
 * freeze. `__lab.training` (lab.js) has `items`, `where(i)`, `triangles`.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { partShows } from '../render3d/models.js';
import { TRAINING_MODELS, trainingActors } from '../render3d/models/training.js';
import { labCrowd } from './labPeople.js';

/** The kinds in their columns, their names and half sizes (metres). */
const KINDS = [
  { kind: 'actor_troupe', x: -22, half: 4, name: 'Actor troupe (grex)', notes: { open: 'rehearsing', out: 'the players out on tour: the cart gone', shut: 'idle' } },
  { kind: 'gladiator_school', x: -8, half: 6, name: 'Gladiator school (ludus)', notes: { open: 'sparring at the post and in pairs', out: 'a pair gone to the arena', shut: 'idle' } },
  { kind: 'menagerie', x: 8, half: 6, name: 'Menagerie (vivarium)', notes: { open: 'feeding the beasts', out: 'the leopard gone to the arena', shut: 'no keepers' } },
  { kind: 'chariot_maker', x: 24, half: 6, name: 'Chariot stable (factio)', notes: { open: 'a team exercised, one harnessed', out: 'a team gone to the races', shut: 'idle' } },
];
const ROWS = [['open', 15], ['out', 0], ['shut', -15]];

/** What each kind shows (those whose model is written: the scene shows the entries there are). */
const ITEMS = KINDS.filter((k) => TRAINING_MODELS[k.kind]).flatMap((k) => ROWS.map(([state, z]) => ({ ...k, state, z, note: k.notes[state] })));

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The training buildings of the shows</h2>
<p><b>The actor troupe</b> (<i>grex</i>): a company under its manager (<i>dominus gregis</i>, as Ambivius Turpio who staged Terence),
its house's stuccoed front the wall of a practice stage of boards, three doors in it (the king's in the middle), masks on pegs; the
players rehearse in their masks (the tragic pale with the tall <i>onkos</i> of hair, the comic ruddy and grinning) to the double pipes
of the piper, as on the rehearsal mosaic from the House of the Tragic Poet at Pompeii; costumes airing on a rail, chests, a wig on its
stand, and the cart the company tours the towns with (Horace's Thespis carried his plays on wagons).</p>
<p><b>The gladiator school</b> (<i>ludus gladiatorius</i>): after the barracks behind the theatre at Pompeii (cells round a colonnaded
court where helmets and greaves were found) and the Ludus Magnus at Rome with its little practice arena: the men drill at the post
(<i>palus</i>) with wooden swords (<i>rudes</i>) and spar in pairs, a murmillo against a thraex, a retiarius with net and trident
against his pursuer, under a trainer (<i>doctor</i>) with his rod; the racks hold the brimmed and crested helmets, the shields and the
nets; the master (<i>lanista</i>) keeps his accounts at his door.</p>
<p><b>The menagerie</b> (<i>vivarium</i>): where the beasts for the shows were kept (Procopius names Rome's by the Praenestine gate),
in cages of timber and iron: a lion pacing, a leopard, a lioness at rest, a bear that rises to scent the air; keepers carrying meat to
them; a cage on a cart for the journey to the arena, as on the Great Hunt mosaic at Piazza Armerina.</p>
<p><b>The chariot stable</b> (<i>factio</i>): the stables of one of the four colours of the circus, its horses in their stalls, a team
yoked to a light racing car being exercised round the yard and another harnessed by the grooms, the harness on pegs, and the palms and
wreaths of the faction's victories over its painted name.</p>
<h3>Controls</h3>
<ul>
<li>Shift+T: this scene. 1 to 4: day, golden hour, night, winter. L: the level of detail. N: snow; T: rain. M, G, Z: the game's zooms;
O: orbit; Q / E: turn the view.</li>
</ul>`;

/** The streets and the ground round the scene. */
function ground(minX, maxX, minZ, maxZ) {
  const g = new Group();
  const earth = new PlaneGeometry((maxX - minX) * 3, (maxZ - minZ) * 3, 1, 1).rotateX(-Math.PI / 2);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  // A street along the front of each row (the buildings face +z) and down the gaps between the columns.
  const streets = [[minX, 21.2, maxX, 22.8], [minX, 6.2, maxX, 7.8], [minX, -8.8, maxX, -7.2], [-16.6, minZ, -15.4, maxZ], [-0.6, minZ, 0.6, maxZ], [15.4, minZ, 16.6, maxZ]];
  for (const [x0, z0, x1, z1] of streets) {
    const p = new PlaneGeometry(x1 - x0, z1 - z0, 1, 1).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
    g.add(new Mesh(tintGeometry(boxUV(p)), material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 })));
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

/** A stand-in building of `kind` in `state` for the models' variant (its walkers: a performer out). */
function standIn(it, frost) {
  const b = { type: it.kind, id: 3 + ITEMS.indexOf(it), x: 0, y: 0, size: it.half / 2, efficiency: it.state === 'shut' ? 0 : 1, walkers: it.state === 'out' ? [1] : [] };
  const v = TRAINING_MODELS[it.kind].variant(b, { snow: frost ? 3 : 0 }, { game: { walkers: new Map([[1, { type: 'performer' }]]) } });
  return { v, b };
}

/** Build the scene (the lab.js commerce scenes' shape: id, group, labels, setLod...). */
export function buildTrainingScene() {
  const group = new Group();
  group.name = 'training-scene';
  group.add(ground(-30, 32, -23, 23));
  const holders = ITEMS.map((it) => {
    const h = new Group();
    h.position.set(it.x, 0, it.z);
    group.add(h);
    return { ...it, h };
  });
  let lod = 0;
  let frost = false;
  const free = (g) => g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  const crowd = labCrowd(group);
  function build() {
    const casts = [];
    for (const it of holders) {
      for (const c of it.h.children) free(c);
      it.h.clear();
      const { v, b } = standIn(it, frost);
      const model = TRAINING_MODELS[it.kind].build(v.key, lod);
      model.traverse((m) => { if (m.isMesh) m.visible = partShows(m.userData.when, v.state, v.ice); });
      it.h.add(model);
      casts.push([trainingActors(it.kind, v.state, b), it.x, it.z]);
    }
    crowd.fill(lod, casts);
  }
  build();
  const labels = ITEMS.map((it) => ({ name: it.name, note: it.note, x: it.x - it.half + 0.5, z: it.z - it.half + 0.5, y: 4.5 }));
  const first = ITEMS[0];
  return {
    id: 'training',
    title: 'Training',
    key: 'Shift+T',
    info: INFO,
    group,
    labels,
    fade: [1, 0, 38, 46],
    // The lab's one lamp light at night: the first building's gate.
    lamp: [first.x, 1.7, first.z + first.half - 0.2],
    shadowBox: 30,
    noAO: [crowd.batch.group],
    items: ITEMS.map((it) => ({ kind: it.kind, state: it.state, x: it.x, z: it.z, half: it.half })),
    get lod() { return lod; },
    setLod(n) {
      if (n === lod) return;
      lod = n;
      build();
    },
    setTurn() {},
    /** A hard frost: the troughs freeze. */
    setWinter(on) {
      if (!!on === frost) return;
      frost = !!on;
      build();
    },
    /** Triangles of each kind's model at a level of detail (built fresh), training. */
    triangles(l = lod) {
      const out = {};
      for (const k of KINDS) {
        if (!TRAINING_MODELS[k.kind]) continue;
        let n = 0;
        TRAINING_MODELS[k.kind].build(TRAINING_MODELS[k.kind].warm[0], l).traverse((o) => { if (o.isMesh) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
        out[k.kind] = n;
      }
      return out;
    },
  };
}
