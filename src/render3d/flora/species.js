/**
 * flora/species.js
 * ----------------------------------------------------------------------------
 * The trees, shrubs and rocks of the WebGL renderer's countryside, as data:
 * what each species is, how it grows (flora/treeModel.js reads it), how it
 * looks month by month, and which of them grow where (flora/layout.js picks
 * a tile's trees from it). Designed from the vegetation of central and
 * southern Italy and the western provinces as botanists and the ancient
 * writers describe it (Theophrastus, Pliny's Natural History XII to XVI,
 * Columella, Virgil's Georgics II), not from the 2D sprites:
 *
 *   cypress   Cupressus sempervirens: the tall dark flame of Tuscan and
 *             Latin hills, planted by tombs and villas; an accent, never a
 *             forest of its own
 *   pine      Pinus pinea, the stone (umbrella) pine of the Tyrrhenian
 *             coast and dunes: a straight red-brown trunk, bare to the
 *             crown, then the flat-topped parasol of needle tufts
 *   holm      Quercus ilex, the holm oak: the evergreen oak of the dry
 *             Mediterranean woods (the forest of the Latin coast), a dense
 *             dark dome down to near the ground, leaves grey beneath
 *   oak       the deciduous oaks of the hills (downy and Turkey oak, the
 *             valonia): a sturdy crooked trunk, a broad open crown of lobed
 *             leaves, russet in autumn; the downy oak keeps its dead leaves
 *             through the winter (marcescent)
 *   chestnut  Castanea sativa, of the Apennine and Campanian hills: a broad
 *             dome of long toothed leaves, golden in autumn, its bark in
 *             deep twisting furrows
 *   plane     Platanus orientalis, by springs and streams (and the shade of
 *             Roman gardens, Pliny XII): tall, its bark flaking in pale
 *             patches, big hand-shaped leaves
 *   poplar    Populus alba, the white poplar of riverbanks (Hercules'
 *             tree): a tall oval crown of leaves dark above and silver
 *             beneath, a pale bark with dark diamonds. Not the columnar
 *             Lombardy poplar, a cultivar of the 17th century
 *   willow    Salix alba, the white willow along every ditch and river,
 *             pollarded (lopped at a man's height) for withies to tie vines
 *             and weave baskets (Columella IV.30): a squat trunk with a
 *             knobbed head and a mop of straight shoots, silvery leaves,
 *             golden twigs in winter
 *   olive     Olea europaea var. sylvestris, the wild olive (oleaster) of
 *             the maquis: low, gnarled, silver-grey
 *   laurel    Laurus nobilis: a dense upright evergreen of shady valleys,
 *             leathery dark leaves
 *   myrtle    Myrtus communis, the maquis shrub (Venus's): low, dense, small
 *             glossy leaves, white flowers in early summer
 *   cherry    Prunus avium, the wild cherry of the deciduous woods: white
 *             blossom in April, red leaves in autumn, banded red-brown bark
 *   almond    Prunus dulcis of the dry south and Spain: a small spreading
 *             tree, pink-white blossom on bare wood in February and March
 *   palm      Phoenix dactylifera, the date palm of the oases (the Desert
 *             Frontier's maps): a ringed slender trunk, a crown of fronds
 *
 * Sizes are a city builder's: a little under nature's (a tile is 4 m), so a
 * forest does not wall off the town, and the species' proportions kept: the
 * cypress tallest and narrowest, the pine's parasol widest.
 *
 * Rocks (flora/rockModel.js): limestone, the rock of most of Italy and the
 * provinces round the Mediterranean, as bedded outcrops cut by joints,
 * boulders broken from them, scree; lichen (grey-green, orange Xanthoria
 * on the tops where birds perch) and moss low on the shaded side; where the
 * province is volcanic (the Phlegraean Fields round Puteoli, the Vulsini
 * hills round Volsinii) dark rounded boulders of lava and tuff among them.
 * ----------------------------------------------------------------------------
 */

/**
 * The species, in a fixed order (a species' index is its place here: the
 * flora pass and the tests use it). For each:
 *   name, latin       for the lab's labels
 *   evergreen         keeps its leaves all year
 *   size              { h: height m, r: crown radius m } before the tile's own scale
 *   form              the crown's envelope (treeModel.js ENVELOPES)
 *   trunk             { h: clear trunk m, r: radius m at the foot, lean, stems, gnarl }
 *   limbs             main limbs: { n, from (share of the trunk where they start), rise
 *                     (how far up they head), bow }
 *   twig              how many branches a limb carries and twigs a branch
 *   leaf              { tex: the spray texture (surfacesFlora.js), card: m, dens (cards a
 *                     square metre of crown), core (darker inner sprays), rough }
 *   bark              { tex, tint (sRGB) }
 *   colours           sRGB foliage by look: leaf, spring, autumn, under (the leaves' undersides,
 *                     mixed in where the wind shows them), dead (marcescent), blossom
 *   looks             the look in each month, Ianuarius first (lookOf)
 *   reach             how far (m) the crown may reach past the tree's own spot
 */
export const SPECIES = Object.freeze({
  cypress: {
    name: 'Italian cypress', latin: 'Cupressus sempervirens', evergreen: true,
    size: { h: 9.5, r: 1.0 }, form: 'flame',
    trunk: { h: 0.6, r: 0.16, lean: 0.02, stems: 1, leader: true },
    limbs: { n: 22, from: 0.05, rise: 0.92, bow: 0.1 },
    twig: { branches: 2, twigs: 2 },
    leaf: { tex: 'leaf-scale', card: 0.55, dens: 9, core: 0.9, rough: 0.75 },
    bark: { tex: 'bark', tint: 0x8a7663 },
    colours: { leaf: [0x2c4a2a, 0x335330, 0x27432a, 0x3a5a34] },
    looks: 'evergreen',
  },
  pine: {
    name: 'Stone pine', latin: 'Pinus pinea', evergreen: true,
    size: { h: 7.4, r: 2.8 }, form: 'parasol',
    trunk: { h: 4.6, r: 0.24, lean: 0.12, stems: 1 },
    limbs: { n: 6, from: 0.82, rise: 0.75, bow: 0.25 },
    twig: { branches: 4, twigs: 3 },
    leaf: { tex: 'leaf-needle', card: 0.8, dens: 7, core: 0.25, rough: 0.7 },
    bark: { tex: 'bark-plates', tint: 0xa0705a },
    colours: { leaf: [0x41612f, 0x4a6b33, 0x3a5a2c, 0x557538] },
    looks: 'evergreen',
  },
  holm: {
    name: 'Holm oak', latin: 'Quercus ilex', evergreen: true,
    size: { h: 6.0, r: 2.2 }, form: 'dome',
    trunk: { h: 1.4, r: 0.2, lean: 0.06, stems: 1 },
    limbs: { n: 6, from: 0.75, rise: 0.6, bow: 0.2 },
    twig: { branches: 4, twigs: 3 },
    leaf: { tex: 'leaf-ovate', card: 0.62, dens: 11, core: 0.8, rough: 0.55 },
    bark: { tex: 'bark', tint: 0x5f5850 },
    colours: { leaf: [0x2f4a26, 0x36522b, 0x2a4322, 0x3d5a2e], under: [0x7d8466, 0x8a9070] },
    looks: 'evergreen',
  },
  oak: {
    name: 'Downy oak', latin: 'Quercus pubescens', evergreen: false,
    size: { h: 7.0, r: 2.6 }, form: 'broad',
    trunk: { h: 1.9, r: 0.26, lean: 0.08, stems: 1, gnarl: 0.25 },
    limbs: { n: 5, from: 0.7, rise: 0.5, bow: 0.35 },
    twig: { branches: 5, twigs: 3 },
    leaf: { tex: 'leaf-lobed', card: 0.7, dens: 8, core: 0.35, rough: 0.7 },
    bark: { tex: 'bark', tint: 0x6e665a },
    colours: {
      leaf: [0x4a6a2c, 0x547532, 0x42612a, 0x5c7a36], spring: [0x8fae4c, 0x9cb85a, 0x84a446],
      autumn: [0x9a6a2c, 0x8a5426, 0xa87a34, 0x7a4a22], dead: [0x8a6a44, 0x7a5a3a, 0x967652],
    },
    looks: 'oak',
  },
  chestnut: {
    name: 'Sweet chestnut', latin: 'Castanea sativa', evergreen: false,
    size: { h: 7.2, r: 2.7 }, form: 'dome',
    trunk: { h: 2.0, r: 0.3, lean: 0.05, stems: 1, twist: 1.6 },
    limbs: { n: 6, from: 0.75, rise: 0.55, bow: 0.25 },
    twig: { branches: 4, twigs: 3 },
    leaf: { tex: 'leaf-serrate', card: 0.75, dens: 8, core: 0.5, rough: 0.6 },
    bark: { tex: 'bark', tint: 0x6a5c4e },
    colours: {
      leaf: [0x46682a, 0x507330, 0x3e5e26, 0x5a7c34], spring: [0x92b450, 0x9fbe5c],
      autumn: [0xc8a03a, 0xb88a2e, 0xd4b04a, 0xa0782a],
    },
    looks: 'deciduous',
  },
  plane: {
    name: 'Oriental plane', latin: 'Platanus orientalis', evergreen: false,
    size: { h: 8.2, r: 2.7 }, form: 'tall-dome',
    trunk: { h: 2.6, r: 0.27, lean: 0.05, stems: 1 },
    limbs: { n: 5, from: 0.7, rise: 0.65, bow: 0.25 },
    twig: { branches: 4, twigs: 3 },
    leaf: { tex: 'leaf-palmate', card: 0.85, dens: 7, core: 0.4, rough: 0.65 },
    bark: { tex: 'bark-mottle', tint: 0xb4a88e },
    colours: {
      leaf: [0x4f7430, 0x5a7e36, 0x46692a, 0x648640], spring: [0x9cbc58, 0xa8c464],
      autumn: [0xb08a3a, 0x9a6e30, 0xc49c48, 0x8a6030],
    },
    looks: 'deciduous',
  },
  poplar: {
    name: 'White poplar', latin: 'Populus alba', evergreen: false,
    size: { h: 9.0, r: 2.0 }, form: 'ovoid',
    trunk: { h: 2.4, r: 0.22, lean: 0.04, stems: 1, leader: true },
    limbs: { n: 9, from: 0.45, rise: 0.85, bow: 0.15 },
    twig: { branches: 3, twigs: 3 },
    leaf: { tex: 'leaf-deltoid', card: 0.65, dens: 9, core: 0.45, rough: 0.6 },
    bark: { tex: 'bark-smooth', tint: 0xc4c2b4 },
    colours: {
      leaf: [0x45682f, 0x4f7236, 0x3e5f2a], under: [0xb8c0b0, 0xc4ccbc, 0xa8b2a0], spring: [0x9cb45a, 0xa8b468],
      autumn: [0xd2b440, 0xc8a434, 0xdcc458],
    },
    looks: 'deciduous',
  },
  willow: {
    name: 'White willow (pollard)', latin: 'Salix alba', evergreen: false,
    size: { h: 5.2, r: 2.1 }, form: 'mop',
    trunk: { h: 2.3, r: 0.3, lean: 0.07, stems: 1, gnarl: 0.4, pollard: true },
    limbs: { n: 16, from: 1.0, rise: 0.95, bow: 0.12 },
    twig: { branches: 2, twigs: 2 },
    leaf: { tex: 'leaf-lance', card: 0.6, dens: 8, core: 0.3, rough: 0.6 },
    bark: { tex: 'bark', tint: 0x7a7266 },
    colours: {
      leaf: [0x7a9060, 0x86996a, 0x6e8558], under: [0xaab4a0, 0xb8c0ae], spring: [0xa4bc6a, 0xb0c478],
      autumn: [0xc8b048, 0xb8a040, 0xd0bc5c], twigs: 0xc0903a,
    },
    looks: 'deciduous',
  },
  olive: {
    name: 'Wild olive', latin: 'Olea europaea var. sylvestris', evergreen: true,
    size: { h: 3.6, r: 1.7 }, form: 'round',
    trunk: { h: 0.9, r: 0.17, lean: 0.18, stems: 2, gnarl: 0.55, twist: 1.4 },
    limbs: { n: 5, from: 0.8, rise: 0.5, bow: 0.3 },
    twig: { branches: 4, twigs: 3 },
    leaf: { tex: 'leaf-lance', card: 0.5, dens: 9, core: 0.4, rough: 0.6 },
    bark: { tex: 'bark', tint: 0x8a857a },
    colours: { leaf: [0x5e6c4a, 0x687652, 0x566444], under: [0xa4ac92, 0x98a088] },
    looks: 'evergreen',
  },
  laurel: {
    name: 'Bay laurel', latin: 'Laurus nobilis', evergreen: true,
    size: { h: 4.2, r: 1.5 }, form: 'tall-dome',
    trunk: { h: 0.5, r: 0.12, lean: 0.05, stems: 3 },
    limbs: { n: 6, from: 0.6, rise: 0.8, bow: 0.15 },
    twig: { branches: 3, twigs: 3 },
    leaf: { tex: 'leaf-ovate', card: 0.55, dens: 12, core: 0.85, rough: 0.45 },
    bark: { tex: 'bark-smooth', tint: 0x6a6658 },
    colours: { leaf: [0x2e4e26, 0x34562a, 0x29452a, 0x3a5c30] },
    looks: 'evergreen',
  },
  myrtle: {
    name: 'Myrtle', latin: 'Myrtus communis', evergreen: true,
    size: { h: 1.7, r: 1.0 }, form: 'shrub',
    trunk: { h: 0.15, r: 0.05, lean: 0.1, stems: 5 },
    limbs: { n: 7, from: 0.5, rise: 0.7, bow: 0.2 },
    twig: { branches: 3, twigs: 2 },
    leaf: { tex: 'leaf-ovate', card: 0.42, dens: 14, core: 0.9, rough: 0.45 },
    bark: { tex: 'bark-smooth', tint: 0x6e6050 },
    colours: { leaf: [0x2f5228, 0x375c2e, 0x2a4824], blossom: [0xf2efe4, 0xece6d6] },
    looks: 'myrtle',
  },
  cherry: {
    name: 'Wild cherry', latin: 'Prunus avium', evergreen: false,
    size: { h: 6.6, r: 2.0 }, form: 'ovoid',
    trunk: { h: 2.2, r: 0.19, lean: 0.05, stems: 1, leader: true },
    limbs: { n: 7, from: 0.5, rise: 0.75, bow: 0.2 },
    twig: { branches: 3, twigs: 3 },
    leaf: { tex: 'leaf-ovate', card: 0.62, dens: 8, core: 0.35, rough: 0.6 },
    bark: { tex: 'bark-smooth', tint: 0x8a5848 },
    colours: {
      leaf: [0x4a6e2e, 0x557a34, 0x426428], spring: [0x8eb04e], blossom: [0xf6f2ea, 0xf2ece2, 0xeee4dc],
      autumn: [0xc0482a, 0xd0682e, 0xa83a26, 0xd89a3a],
    },
    looks: 'cherry',
  },
  almond: {
    name: 'Almond', latin: 'Prunus dulcis', evergreen: false,
    size: { h: 4.4, r: 1.9 }, form: 'round',
    trunk: { h: 1.0, r: 0.15, lean: 0.14, stems: 1, gnarl: 0.2 },
    limbs: { n: 5, from: 0.85, rise: 0.55, bow: 0.3 },
    twig: { branches: 4, twigs: 3 },
    leaf: { tex: 'leaf-lance', card: 0.52, dens: 8, core: 0.3, rough: 0.6 },
    bark: { tex: 'bark', tint: 0x4e4640 },
    colours: {
      leaf: [0x5a7a3a, 0x648442, 0x527034], spring: [0x86a84c], blossom: [0xf6e8ea, 0xf2dce2, 0xead0d8],
      autumn: [0xb8a040, 0xa88a36, 0xc4ac50],
    },
    looks: 'almond',
  },
  palm: {
    name: 'Date palm', latin: 'Phoenix dactylifera', evergreen: true,
    size: { h: 8.0, r: 2.6 }, form: 'palm',
    trunk: { h: 6.6, r: 0.2, lean: 0.12, stems: 1 },
    limbs: { n: 18, from: 1, rise: 0.4, bow: 0.5 },
    twig: { branches: 0, twigs: 0 },
    leaf: { tex: 'leaf-frond', card: 2.6, dens: 0, core: 0, rough: 0.6 },
    bark: { tex: 'bark', tint: 0x8a7458 },
    colours: { leaf: [0x5a7038, 0x647a40, 0x506632], dead: [0x9a8458, 0x8a7448] },
    looks: 'evergreen',
  },
});

/** The species' names in their fixed order. */
export const SPECIES_IDS = Object.freeze(Object.keys(SPECIES));

/**
 * Looks by month (Ianuarius first): what a species shows. 'bare' winter
 * wood; 'spring' young leaves, light and sparse; 'blossom'; 'leaf' summer;
 * 'autumn'; 'dead' a winter crown of dead leaves (the downy oak's);
 * 'flower' the myrtle in flower in early summer. Evergreens show 'leaf'
 * all year.
 */
const CALENDARS = Object.freeze({
  evergreen: ['leaf', 'leaf', 'leaf', 'leaf', 'leaf', 'leaf', 'leaf', 'leaf', 'leaf', 'leaf', 'leaf', 'leaf'],
  // Leafing out in April, turning in October, bare from December.
  deciduous: ['bare', 'bare', 'bare', 'spring', 'leaf', 'leaf', 'leaf', 'leaf', 'leaf', 'autumn', 'autumn', 'bare'],
  // The downy oak: late to leaf, its dead leaves held through the winter.
  oak: ['dead', 'dead', 'dead', 'spring', 'spring', 'leaf', 'leaf', 'leaf', 'leaf', 'autumn', 'autumn', 'dead'],
  // In flower with the first leaves in April.
  cherry: ['bare', 'bare', 'bare', 'blossom', 'spring', 'leaf', 'leaf', 'leaf', 'leaf', 'autumn', 'autumn', 'bare'],
  // The first blossom of the year, on bare wood: February and March.
  almond: ['bare', 'blossom', 'blossom', 'spring', 'leaf', 'leaf', 'leaf', 'leaf', 'leaf', 'autumn', 'autumn', 'bare'],
  // White flowers in June and July.
  myrtle: ['leaf', 'leaf', 'leaf', 'leaf', 'leaf', 'flower', 'flower', 'leaf', 'leaf', 'leaf', 'leaf', 'leaf'],
});

/** Every look a species can show (its kits are built per look). */
export const LOOKS = Object.freeze(['leaf', 'spring', 'blossom', 'autumn', 'bare', 'dead', 'flower']);

/** The look species `sp` shows in `month` (0 = Ianuarius); null (seasons off): summer's. */
export function lookOf(sp, month) {
  const cal = CALENDARS[SPECIES[sp].looks];
  if (month === null || month === undefined) return cal[6];
  const m = ((Math.round(month) % 12) + 12) % 12;
  return cal[m];
}

/** The looks a species shows over a year (the kits a game may want). */
export function looksOf(sp) {
  return [...new Set(CALENDARS[SPECIES[sp].looks])];
}

/**
 * Which species grow where, by climate: the weights of each in three
 * habitats by the tile's distance to water: `wet` (the banks, 2 tiles or
 * less), `fresh` (3 to 6), `dry` (7 and more). A stand is clumped round one
 * species of the mix (layout.js); `accent` species are never a stand's
 * own, only scattered (the cypress), and `shrub` ones grow under the trees
 * and on their own.
 *
 *   tyrrhenian  the Etruscan coast, Liguria, Campania, Lucania, Bruttium:
 *               holm oak and stone pine near the sea, the deciduous oaks
 *               and chestnut inland, plane, poplar and willow by water
 *   adriatic    Picenum, Samnium, Apulia: deciduous oak woods, chestnut,
 *               wild cherry, almond in the dry south
 *   padane      Gallia Cisalpina, the Po plain: oaks, poplars and willows,
 *               no stone pine, no wild olive
 *   iberian     Hispania: the holm oak's open woods, stone pine, wild
 *               olive, almond
 *   narbonese   Gallia Narbonensis: holm and downy oak, pine, a few
 *               cypresses and almonds
 *   desert      the Desert Frontier's oases: date palms, wild olive,
 *               almond, a few holm oaks
 */
export const CLIMATES = Object.freeze({
  tyrrhenian: {
    wet: { poplar: 3, willow: 3, plane: 2.2, oak: 0.8, laurel: 0.6 },
    fresh: { oak: 2.6, holm: 2.2, chestnut: 1.4, laurel: 0.9, cherry: 0.6, pine: 0.8, cypress: 0.35 },
    dry: { holm: 3, pine: 2.6, oak: 0.9, olive: 1.2, laurel: 0.4, almond: 0.25, cypress: 0.5 },
    shrub: 'myrtle',
  },
  adriatic: {
    wet: { poplar: 3, willow: 3, plane: 1.2, oak: 1 },
    fresh: { oak: 3.5, chestnut: 1.6, cherry: 0.9, holm: 0.9, laurel: 0.4, cypress: 0.3 },
    dry: { oak: 3, holm: 1.5, almond: 0.7, olive: 0.8, pine: 0.4, cypress: 0.5 },
    shrub: 'myrtle',
  },
  padane: {
    wet: { poplar: 4, willow: 4, plane: 1 },
    fresh: { oak: 4, cherry: 1, poplar: 1.2, chestnut: 0.6 },
    dry: { oak: 3.5, chestnut: 1.2, cherry: 1, cypress: 0.2 },
    shrub: 'laurel',
  },
  iberian: {
    wet: { poplar: 3, willow: 2, plane: 0.6, oak: 0.6 },
    fresh: { holm: 3.5, oak: 1.1, pine: 1.4, olive: 1.4, almond: 0.5, cypress: 0.2 },
    dry: { holm: 3.2, pine: 2, olive: 2, almond: 0.7, cypress: 0.3 },
    shrub: 'myrtle',
  },
  narbonese: {
    wet: { poplar: 3, willow: 2, plane: 1.2 },
    fresh: { oak: 3, holm: 2, pine: 1, cherry: 0.4, almond: 0.3, cypress: 0.3 },
    dry: { holm: 3, pine: 2.2, oak: 1, olive: 1, almond: 0.3, cypress: 0.5 },
    shrub: 'myrtle',
  },
  desert: {
    wet: { palm: 5, willow: 0.6, olive: 0.8 },
    fresh: { palm: 3.5, olive: 1.6, almond: 0.8, holm: 0.4 },
    dry: { olive: 2, palm: 1.5, almond: 1, holm: 0.6 },
    shrub: 'myrtle',
  },
});

/** Species that are never a stand of their own: they stand here and there among the others. */
export const ACCENTS = Object.freeze(['cypress']);

/** The climate of each region of the provinces (data/sites.js `region`). */
const REGION_CLIMATE = Object.freeze({
  Etruria: 'tyrrhenian', Liguria: 'tyrrhenian', Campania: 'tyrrhenian', Lucania: 'tyrrhenian', Bruttium: 'tyrrhenian', Latium: 'tyrrhenian',
  Picenum: 'adriatic', Samnium: 'adriatic', Apulia: 'adriatic',
  'Gallia Cisalpina': 'padane',
  Hispania: 'iberian',
  'Gallia Narbonensis': 'narbonese',
});

/**
 * How much of a province's rock is volcanic, by its site (data/sites.js):
 * the Phlegraean Fields' tuff and trachyte round Puteoli, the Vulsini
 * volcanoes round Volsinii; none elsewhere (the limestone of the rest).
 */
const VOLCANIC = Object.freeze({ puteoli: 0.5, volsinii: 0.35 });

/** A province's climate and rock: { climate, volcanic } from its region, site and map type. */
export function climateOf({ region = '', site = '', type = '' } = {}) {
  const climate = type === 'desert' ? 'desert' : REGION_CLIMATE[region] || 'tyrrhenian';
  return { climate, volcanic: VOLCANIC[site] || 0, desert: type === 'desert' };
}

/** The rock kinds (rockModel.js builds them) and how many shapes of each. */
export const ROCKS = Object.freeze({
  outcrop: { n: 3, name: 'Limestone outcrop' },
  boulder: { n: 4, name: 'Limestone boulder' },
  scree: { n: 2, name: 'Scree' },
  lava: { n: 3, name: 'Volcanic boulder' },
});

/** Shapes (seeds) a species is grown in: two never-alike trees of each. */
export const TREE_VARIANTS = 2;
