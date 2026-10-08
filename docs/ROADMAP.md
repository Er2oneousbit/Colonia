# Roadmap

What exists, what Caesar III had that Colonia does not (yet), and how to modernize it. New feature requests are added here first; bugs are fixed right away.

## The plan: a remake, modernized

Colonia is a remake and modernization of Caesar III. The original's rules, buildings and campaign shape are the core, rebuilt with original art, sound and text. On top come the quality-of-life changes players now expect, many of them first seen in the community engines: Julius (the original's exact game logic on modern systems) and Augustus (Julius plus gameplay improvements such as roadblocks, market special orders and monuments).

## Next up (suggested order)

1. **Logistics from the mods**: market special orders, partial warehouse storage, supply posts for forts, and roadblock permissions on gates, bridges, granaries and warehouses.
2. **Playtest the late campaign** (steps 6 to 10, v0.17.0): then decide what "The late missions need more jobs" below leaves open.

Alongside: the sim fuzzer and the save corpus, so all of this lands without breaking anyone's city.

## Done (v0.20.22)

* **The temples, the oracle and the mission post in 3D** (under WebGL): the small temple a podium temple in miniature after the Temple of Portunus and the Maison Carree, four columns across its porch, bronze doors, the god's statue inside and the altar before the steps; the grand temple a marble temple of six columns across after Mars Ultor and the Capitolium of Brescia, in a court of porticoes round its great altar. Each god in its own order, colours and gilt dedication: Ceres Tuscan with sheaves and torches (CERERI), Neptune Ionic in sea blue with tridents and dolphins (NEPTVNO), Mercury Corinthian with the caduceus and roosters (MERCVRIO), Mars in crimson with trophies and shields (MARTI·VLTORI), Venus with doves, shells, myrtle and roses (VENERI·GENETRICI). The oracle a round tholos over a smoking cleft and a spring, tripods burning; the mission post a walled sacellum of Pax with the envoys' lodging and gifts for the villages. Staffed, the doors stand open and the altar fire burns; in a festival month garlands, a crowd in wreaths, a flute player and the victim; an angry god's altar sends up black smoke; unstaffed, shut and cold. Console: `temples [n]`
* Headless sim: identical to v0.20.21 on every difficulty
* 1292 unit tests, 268 browser checks

## Done (v0.20.21)

* **Woods trimmed** (under WebGL): trees at about two thirds of their species' size, so a wood stands about twice a house's height instead of three times, with fewer second trees and shrubs (about 1.3 plants a tile, from nearly 2) and lone trees off their tile's middle, so woods no longer hide the streets or stand in rows. Far trees lost the patches of sky blue in their crowns (leaf cards baked facing away from the camera, lit as mirrors)
* **Walkers on a cleared road are no longer lost:** each steps over open ground to the nearest road (up to 8 tiles) that leads where it was going and carries on, carts with their loads; before, it vanished
* **One senate house per city**, as in the original
* **The school's board** in 3D reads ARMA VIRVMQVE CANO, the Aeneid's opening that Pompeii's schoolboys scratched on its walls, in place of an alphabet that read as English
* Headless sim: identical to v0.20.20 on every difficulty
* 1283 unit tests

## Done (v0.20.20)

* **The senate house and the governor's residences in 3D** (under WebGL): the senate house after the Curia Julia and Sabratha's curia, a tall hall on a podium behind six Corinthian columns with CVRIA on the frieze, bronze doors under S·P·Q·R and a gilt Victory on the gable, senators in purple-striped togas on its steps and lictors with their fasces; the Governor's House a Pompeian atrium house round its impluvium and a painted peristyle; the Villa a great peristyle with a long pool, playing jets, statues and lemon trees, the governor dining with his guests in the triclinium; the Palace on a raised platform behind a gate of Corinthian columns cut REGIA, a court with two fountains and cypresses, an audience hall with gilt capitals, a gilded ridge and an eagle, two-storey wings either side. When rioters or enemies come near, the doors are barred, the household goes in and more guards stand out; in a hard frost the pools freeze and the fountains stop. Console: `government [house|villa|palace]`
* Headless sim: identical to v0.20.19 on every difficulty
* 1280 unit tests, 266 browser checks

## Done (v0.20.19)

* **Gardens, statues, the gardeners' yard and the triumphal arch in 3D** (under WebGL): gardens after Pompeii's excavated peristyles, clipped box hedges round beds of roses, oleander, myrtle, acanthus and lilies, a basin, a pergola hung with oscilla, a sundial or a pool with a winged boy, no two alike, joining their hedges with neighbouring gardens into one garden, and following the months (bare vines in winter, roses in May, grapes ripening purple in autumn); untended they grow ragged and dry. Statues carved after the Prima Porta Augustus, a togate patron and a bronze general, an equestrian emperor after Marcus Aurelius or one enthroned after the Cumae Augustus, on inscribed bases; untended they weather green with lichen and patina, their wreaths fallen. A topiarius's yard with seedlings in pierced pots and box clipped to cones. A triumphal arch after the Arch of Titus with Victories, a relief of the procession and a gilt quadriga, turned along its road. Console: `gardens [n] [wild]`
* Headless sim: identical to v0.20.18 on every difficulty
* 1269 unit tests, 264 browser checks

## Done (v0.20.18)

* **The barber, the physician, the baths and the hospital in 3D** (under WebGL): the barber's shop open to the street, a client under a linen cloth with the razor at his cheek and neighbours gossiping on the bench; the physician's consulting room under MEDICVS, the doctor taking a patient's pulse, his assistant grinding a remedy, the staff of Asclepius outside; a neighbourhood bath after Pompeii's Stabian and Forum baths, a vaulted hot room and a domed one, the furnace and its stoker, bathers in the exercise yard, steam rising in winter, cold and shut without workers, an empty pool without water; a hospital on the army's plan, wards round a corridor and a court of medicinal herbs, a surgeon at work in the operating hall, convalescents in the sun. Console: `healing` builds them beside the city
* A browser check fixed: the "ground off" check read the renderer a fixed 400 ms after switching, which with more models drawn under a software GL could still be the frame before; it now waits for the switch
* Headless sim: identical to v0.20.17 on every difficulty
* 1260 unit tests, 262 browser checks

## Done (v0.20.17)

* **Aqueducts and the reservoir in 3D** (under WebGL): aqueducts are arcades in the province's stone (tufa and peperino as the Aqua Marcia and Claudia, limestone as the Pont du Gard and Segovia, brick-faced concrete), an arch a tile, joining up as you drag them, with pierced piers at turns and branches; where one crosses a road it springs a wider arch of dressed travertine after the Porta Maggiore. Its open channel on top shows the water running, with leak stains down the piers, or dry silt when it carries none, and it steps down into a reservoir in a stair of falls. The reservoir is a castellum aquae after Pompeii's at the Porta Vesuvio: an open tank lined in pink signinum, the distribution house with three outlets and lead pipes with bronze stopcocks, water towers at its corners and overflows into troughs; full or dry as the sim says, its water's margins freezing in a hard frost
* Headless sim: identical to v0.20.16 on every difficulty
* 1252 unit tests, 260 browser checks

## Done (v0.20.16)

* **The school, the library and the academy in 3D** (under WebGL): a school held under a portico as Roman schools were, the master in his wicker chair under an awning, the alphabet on an easel, boys on benches with wax tablets and rolls; a library behind four marble columns with BIBLIOTHECA cut over them, its cupboards of rolls, Minerva and the herms of Homer, Ennius, Plato and Cicero in its court, a reader and a scribe; an academy round a half-round exedra and a garden with box hedges and a sundial, a speaker declaiming to his listeners and two walking in the covered walk. Staffed, their doors and cupboards stand open and their people are there; idle, all is shut. Console: `learning` builds one of each beside the city
* A browser check fixed at its cause: the walker-press check picked walkers a few steps from home, who were gone by the release (three in a row once); it now picks those with plenty of walk ahead
* Headless sim: identical to v0.20.15 on every difficulty
* 1243 unit tests, 259 browser checks

## Done (v0.20.15)

* **The forts, the barracks and the military academy in 3D** (under WebGL): Roman forts in miniature after Housesteads, the Saalburg and Vindolanda, kept low so the soldiers at rest stay in view in the yard: the legion fort in coursed sandstone with the eagle, the signa and the headquarters' portico; the archer fort a turf rampart with timber towers, leather tents and straw butts; the cavalry fort limewashed with stable-barracks, a horse for each trooper and the dragon standard. Deployed, the standards are gone; empty, the gate is shut. The barracks' armoury fills with arms and arrows as its stock comes in and a recruit drills at the post; the Campus is a training ground with a hall of the town's young men, posts, butts and a riding ring
* **Town walls, gates and the watchtower in 3D**: walls in the province's own stone (polygonal limestone, squared tufa, ashlar, or brick on the Po's plain) that join up as you drag them, with towers at corners and every eight tiles; gates after Turin's and Pompeii's, arched between round towers, shut while an enemy is near; cracked, broken down and breached as raiders strike. The watchtower is a stone tower with a timber gallery, its archers on watch, a torch burning at night
* **The fleet's buildings in 3D**: the navalia's ship shed and open slip, where the liburnian takes shape as it is built (keel, planks, oar box, bronze ram, painted eye); the naval station's moles of arched piers with a beacon tower burning at night; the training harbour's rowing benches on the shore, where a new ship's crew pulls at the oars while the boarding bridge drops onto a practice hulk. All three stand out over the water on piles
* A browser check fixed: the hippodrome check had no room for a 15 x 5 track near the city on a wooded random map; it now clears the trees there first and logs the seed
* Headless sim: identical to v0.20.14 on every difficulty
* 1235 unit tests, 257 browser checks

## Done (v0.20.14)

* **The prefecture in 3D** (under WebGL): a watch house of Rome's vigiles after the VII cohort's in Trastevere, brick under a tiled gable with VIGILES COH·VII over the studded door, a household shrine, pitched rope buckets on a rack, a force pump in its water tank, a ladder, a roof hook and axes; while its crew is out at a fire its kit is gone and one man keeps the door; idle, it is shut; its lantern burns at night
* **The engineer's post in 3D**: a builders' yard of the fabri, a half-timbered workshop under a lean-to roof with COLLEGIVM·FABRVM on its sign, shear legs hoisting a block in iron tongs, a groma by the street, timber, bricks, ashlar, lime and pozzolana; working, the surveyor sights along the groma and the block is raised; idle, it rests on rollers and the tools are racked
* The project's main branch is now `main`
* Headless sim: identical to v0.20.13 on every difficulty
* 1194 unit tests, 251 browser checks

## Done (v0.20.13)

* **Trees and rocks in 3D** (under WebGL with the 3D ground): fourteen species of Italy and the western provinces as the Roman writers describe them, each known by its outline: the Italian cypress's flame, the stone pine's parasol, holm and downy oaks, the sweet chestnut, the oriental plane, white poplars and pollarded willows by the water, wild olive, laurel and myrtle, wild cherry and almond in blossom in spring, date palms at desert oases. Where each grows comes from the map (banks, dry ground, the province), in stands of one kind. Deciduous trees turn in autumn and stand bare in winter, snow lies on the branches, the crowns sway in the wind and rain darkens the bark. Rocks are bedded limestone outcrops with lichen and moss, boulders and scree, dark lava on volcanic maps. Far out, trees are drawn as pictures baked on the GPU, so a whole Uber map of forest costs a fraction of a millisecond; up close, about 3 ms a frame
* Headless sim: identical to v0.20.12 on every difficulty
* 1186 unit tests, 251 browser checks

## Done (v0.20.12)

* **Closer zoom under WebGL**: three more zoom levels, 3x, 4x and 6x, to see the 3D art up close (the wheel, + and -, and a pinch reach them); the models show their finest detail there, the market's awnings and the idle farms' weeds were remade to hold up at 6x, and the flat art still in use is drawn sharp up to 4x and smoothly enlarged past it. Classic keeps its five levels: switching to it, or opening a game saved at 4x in it, goes to its closest zoom on the same spot. Measured on a Large city at a pixel ratio of 2: about 20 ms a frame at every zoom; the F3 readout shows the zoom and the sprite memory
* Headless sim: identical to v0.20.11 on every difficulty
* 1176 unit tests, 250 browser checks

## Done (v0.20.11)

* **The market in 3D** (under WebGL): a macellum after Pompeii's, Puteoli's and Leptis Magna's, a tholos of eight columns over a water basin with fish on its marble counters, and stalls round the court under striped awnings selling what the market holds (sacks of grain, baskets of produce, oil and wine jars, red pottery, furniture, cloth), more as its stock grows; with no workers the awnings are rolled up
* **The forum in 3D**: the tax office on a travertine podium behind four columns, TABVLARIVM PVBLICVM over them, a counting table with coin, a tablet and a balance, a strongbox, a tribunal and a statue; working, its doors are open and a clerk takes a citizen's payment; idle, all is shut
* **The warehouse in 3D, showing how full it is and with what**: a horreum after Ostia's, brick behind a gateway of columns and a pediment, its court filling load by load with the goods it holds as they look (wine and oil in their amphorae, sacks, baskets, barrels, logs, iron bars, marble blocks, bolts of linen, crates of pottery and arrows, furniture, shields)
* Measured on a stocked Large city at a pixel ratio of 2: 19.2 to 20.9 ms a frame (18.3 to 20.4 with their sprites)
* A browser check fixed: the 3D ground's overlay check read its colours a fixed three frames after a change, while a software GL could still be settling the picture; it now reads once two reads agree
* Headless sim: identical to v0.20.10 on every difficulty
* 1172 unit tests, 249 browser checks

## Done (v0.20.10)

* **The farms in 3D** (under WebGL): one farmhouse after Cato, Varro, Columella and the farmsteads round Pompeii (rubble walls, a tiled roof, a grain loft, a lararium by the door), and each kind's working things: wheat's threshing floor, straw stack and stooks; the vegetable garden's wattle fence and well sweep; orchards of apple, pear and fig, bare in winter, in blossom in spring, in fruit as it ripens; gnarled olives and an oil mill; vines on stakes with grapes in late summer and a treading vat; flax on drying racks by a retting pond; a pig sty with pigs rooting, more as the farm prospers; a stable with a horse in the paddock for each breeding mare. A farm at rest for the winter has its tools put away, one with no workers its shutters closed and its stacks slumped
* **The granary in 3D, showing how full it is**: a horreum after Ostia's, on a platform raised to cart height with vents, buttresses and louvred slits; its platform fills with the foods it holds, a cart's load a place (sacks of wheat, baskets of vegetables and fruit, hams, fish), so how full it is and with what reads at a glance from any side
* Measured with 40 farms and granaries on a Large map at a pixel ratio of 2: 19.7 to 20.5 ms a frame (18 with their sprites)
* Headless sim: identical to v0.20.9 on every difficulty
* 1160 unit tests, 248 browser checks

## Done (v0.20.9)

* **Fullscreen when a game starts**: Begin, Continue and Load open the game fullscreen (*Settings > Fullscreen when a game starts*, on by default); a ⛶ button in the top bar and the game menu goes back in after Esc
* **The WebGL renderer runs lighter, above all on laptops**: its picture is drawn straight on the page instead of copied onto the 2D canvas, the night and lightning are drawn on the GPU, and *Settings > Render scale* (Auto by default) lowers the 3D ground's resolution, then the scene's, when frames run long, never the menus or text. On a GPU built into the processor Auto starts with the ground on Low. Measured at a pixel ratio of 2 on a desktop GPU: Low 9.8 to 12.6 ms a frame (was 14.6 to 19.8), 6.1 to 6.8 ms with the ground at half its pixels; without a GPU at all 55 to 171 ms (was 463 to 832)
* **A performance readout** (F3, or *Settings*): frames per second, milliseconds by stage, the GPU's own time, draw calls, the render scale and the GPU Chrome is using, with a hint when it is the processor's built-in one (Windows can be told to give Chrome the graphics card)
* **3D models never wait silently**: a model or texture that fails to compile or paint is retried, then left as its sprite, and the console says why
* **The ship bridge's leftovers**: a crossing of two ship bridges, or a shore road beside a bridge's first water tile, is a level landing with no step (it was 11 to 22 px), its parapet open on the joining side; a ship's mast sinks behind the far parapet and rises again past the near one instead of vanishing and popping
* Headless sim: identical to v0.20.8 on every difficulty
* 1150 unit tests, 246 browser checks

## Done (v0.20.8)

* **Nobody is left inside a huge placement**: a soldier, raider, wolf or villager deeper than 12 tiles inside what is built at once (a big drag of buildings) now steps out to the nearest open ground too; the search for room goes on to the map's edge when nothing is found close by
* CI: the workflows' actions are on their current versions (the old ones ran on a retired Node), and the runner is pinned to Ubuntu 24.04 so the move of `ubuntu-latest` to Ubuntu 26 cannot break the browser test unannounced
* A browser check that failed now and then since v0.18.8 found its cause: on some random maps no free meadow lies within 10 tiles of a road, so the flax farm had nowhere to go; the check now lays one meadow tile by a road there (it tests the menu and placing, not the map) and logs the seed
* Headless sim: identical to v0.20.7 on every difficulty
* 1132 unit tests, 234 browser checks

## Done (v0.20.7)

* **Crossings between streets are paved in 3D**: a road tile joining two or more paved streets (a crossing where streets meet with no building of its own, a gap between two blocks) is basalt too, not a gravel square in the middle of town
* A browser check fixed: the fort hotkey check pressed Shift+1 for fort I, which on some random maps was a fort the garrison had not manned yet (a cavalry fort waiting for horses) and rightly had no standard to hand; it now uses the number of the fort that has soldiers
* 1131 unit tests, 234 browser checks

## Done (v0.20.6)

* **Streets wrap round their blocks in 3D**: a road is paved as a town street when a building stands on any of its eight sides, not only its four, so a block's corners and the crossings at its ends are basalt like the streets beside them instead of gravel islands; a short straight gap between two blocks is paved too
* 1131 unit tests, 234 browser checks

## Done (v0.20.5)

* **The fountain in 3D, in four looks that follow its neighbourhood** (under WebGL): a plain lava lacus like most of Pompeii's street fountains, a limestone lacus with a carved water-god head, a marble basin with a bronze lion's-head spout, and a small nymphaeum with a mosaic niche, columns and a nymph pouring water. The look comes from the desirability of the fountain's tile, as fountains looked finer in finer quarters in the original (render only: the rules do not change). Water runs from the spout with rings and an overflow; a fountain with water but no workers stands still, one without water is dry and stained; in hard frost the water keeps running under icicles
* **The look lab's well and fountain in the game**: the WebGL renderer now draws them with the lab's materials, casting real shadows on the 3D ground, many at once in a handful of draw calls, simpler when zoomed out; placing one shows the model as a see-through ghost. Measured with 100 wells and 100 fountains on an Uber map: 76 to 91 draw calls (was up to 3,041)
* Headless sim: identical to v0.20.4 on every difficulty
* 1130 unit tests, 234 browser checks

## Done (v0.20.4)

* **Every kind of ground in 3D**: farms now grow on the 3D ground, wheat, vegetables and flax from ploughed to sprouting, growing, ripening and ripe (wheat turns gold, flax flowers blue), stubble while resting in winter and weeds when nobody works them; orchards, olive groves and vineyards hoed round each tree and vine; a pig pen's mud and straw and a ranch's grazed paddock; trodden yards round buildings; worn grass along walls and aqueducts; a burned ruin of ash and charred beams with scorched grass round it, embers while it burns, the snow melted round a fire; native villages' yards and plots. Pasture, meadow and scrub flower in spring, the forest floor is oak leaves, needles and moss turning russet in autumn, beaches are warmer sand, and only the sea has surf. A new tiling hides repeats even at the closest zoom. Frame time unchanged; the 3D ground first appears about half a second later (a longer shader to prepare)
* The look lab's **Ground types** gallery (Y): 25 labelled cards, every kind of ground and the transitions worth checking, through the seasons, snow, rain and the times of day
* Headless sim: identical to v0.20.3 on every difficulty
* 1125 unit tests, 233 browser checks

## Done (v0.20.3)

* **Textures painted on the graphics card**: every texture of the 3D look (the well's stone, wood, bronze and paving, and the ground's fourteen layers) is now painted by the GPU in well under a second, the same textures as before (on average within a fifth of a shade). The lab opens with its first picture in 1.2 s on a first visit, even in a sandboxed frame where browser storage is blocked (was 4.9 s), and the WebGL renderer's 3D ground first draws at 2.2 s (was 2.75) without a stall. The CPU worker pool and the browser texture cache are gone
* **Fewer shader programs, compiled ahead**: materials that differed only in small options share programs, and every program the first frame needs is compiled in the background before it
* 1118 unit tests, 233 browser checks

## Done (v0.20.2)

* **Cleaner roads in 3D**: the wheel ruts are gone from gravel roads and the look lab's street (they read as streaks), and the lab's basalt street ends in a row of edge stones with the earth starting behind them, where the earth's bumps used to wander over the paving
* A browser check fixed: the festival check put the temples of Ceres back as they were before clicking the small festival, so when the demo city's temple happened to be unstaffed the festival was refused; it now clicks first
* 1125 unit tests, 230 browser checks

## Done (v0.20.1)

* **3D ground under the WebGL renderer**: every kind of the map's ground is now lit 3D ground, each with its own look: pasture, a lusher meadow with flowers where farms can go, dry scrub far from water, the forest floor under the trees, limestone outcrops, dune sand and beaches with a wet band, a farm's ploughed soil, rivers and the sea deepening from clear shallows with ripples, sky reflections and foam at the shore. Country roads are rammed gravel with ruts; a road with a building beside it becomes a basalt street with kerbs, so a town paves itself as it grows; plazas are travertine, rubble a heap of stone and tile. The seasons colour what grows day by day, snow builds up and leaves the roads trodden, rain darkens the ground and fills the ruts. *Settings > Ground*: Auto, High, Low or Flat (the old ground). On a desktop GPU an Uber map zoomed out draws in 10.9 ms a frame against 15.2 ms with the old ground. Classic is unchanged
* **Textures load fast**: the 3D look's textures are painted on every CPU core at once, drawn from the first frame in plain colours that sharpen as they arrive, and kept in the browser for the next visit (thrown away by themselves when a recipe changes; console `textures clear`). The ground's textures are in at 1.4 s on a first visit (was up to 3.1) and 0.4 s on the next; every texture is the same to the byte
* The look lab (`node scripts/build.mjs --lab`): the 3D look's target, a Roman street well and every kind of ground, by day, golden hour, night and winter
* Headless sim: identical to v0.20.0 on every difficulty
* 1125 unit tests, 230 browser checks

## Done (v0.20.0)

* **A WebGL renderer (beta), the start of 3D art**: *Settings > Renderer* now offers WebGL (beta) beside Classic (2D), switched live; `?renderer=3d` picks it for a page. It draws the same city through three.js, and buildings can now be 3D models one type at a time, everything else keeping its sprite. The well is the first: paving, a stone ring, water, posts and a bucket, turning with the view. Classic stays the default and draws exactly as before (0 differing pixels against v0.19.13 in 12 views). The renderer now works out what to draw once and hands it to a back end (`render/canvasBackend.js` or `render3d/webglBackend.js`); models register in `render3d/models.js`. Measured on a desktop GPU: a whole Large map zoomed out draws in 17 ms a frame with WebGL against 114 ms in Classic, a whole Uber map 29 ms against 231 ms. Without WebGL, or when its context is lost, Classic draws. three.js (MIT) is credited; the game file grew from 1.20 MB to 1.74 MB
* Headless sim: identical to v0.19.13 on every difficulty
* 1093 unit tests, 221 browser checks

## Done (v0.19.13)

* **The sim is layered, with no import cycles**: the toolbox every sim module leaned on, which lived in `military.js` beside the orchestration, moved into leaf modules (`units`, `unitMove`, `combat`, `damage`, `field`, `demand`, `berths`, `forts`, `away`, `vendorNeed`), every function body as it was; `military.js` (2,147 lines, now 1,253) keeps the raids and the per-tick orchestration and imports the rest. The one upward call (a wolf's death counted by the wildlife module) goes through the `unitDied` event. The old modules re-export the moved names for the UI, dev tools and tests. A test (`tests/imports.test.mjs`) now fails on any new cycle, or on a sim module importing through a re-export
* Headless sim: identical to v0.19.12 on every run (twelve compared, from Easy to the garrison, navy, harbor, monument and games runs)
* 1083 unit tests, 214 browser checks

## Done (v0.19.12)

* **A once-over of the code**: nine helpers and tables nothing used are gone (`REQ_LABELS`, `GROWTH_TIERS`, `tileTop`, `asTurned`, `houseLabel`, `legionOnMap`, `barracksStatus`, `coverageWord`, `MONUMENT_TYPE_KEYS`), two unused imports with them, and the three identical `plural` helpers of the UI are one in `ui/dom.js`. Nothing else: no `Math.random` in the sim, no em dashes, no `var`, no `eval`, `innerHTML` only on static text, storage reads guarded
* Headless sim: identical to v0.19.11
* 1081 unit tests, 214 browser checks

## Done (v0.19.11)

* **The Great Arena reaches the whole city a little**: a staffed Arena gives every home +5 entertainment (Augustus's rule, added after the seat-based base so nothing counts twice; the hippodrome already gave about as much through the base), and its performers walk 52 tiles, twice other entertainers, as the hippodrome's charioteers do
* **Ludi and Circenses**: games at a staffed Great Arena with gladiators or beasts booked (200 Dn + 0.6 a citizen) lift the city mood +10, races at the hippodrome with races booked (150 + 0.5 a citizen) +8, each fading a fifth a month on top of any festival, each kind once in 6 months, from the venue's panel or the Entertainment advisor
* Saves: version 33 (an older save has held none)
* Headless sim: every level identical to v0.19.10; the uptown run, with its Arena, ends with the city mood 2 higher
* 1081 unit tests, 214 browser checks

## Done (v0.19.10)

* **Marble for the grand buildings**, taken from the warehouses when placed, all or nothing (the build menu shows it, greyed out with the reason when short; undo gives it back): a Statue 100, a Grand Statue, each large temple and the Oracle 200, the Governor's Palace 400, the Great Arena 600, the hippodrome 800. Not the Senate, the small statue or the monuments (which keep their stages)
* **The top homes need marble**: from the Marble Villa up (levels 16 to 20), at half the usual rate of a good (about 2.7 a month for a Marble Villa: a quarry keeps some 35 supplied), carried by market vendors; the Peristyle Villa stocks it ahead of moving up
* Every mission that needs marble has a source: the Marble Quarry now comes from mission 3 (Figlina, Firmum, Pons Aelius and Paestum have rock); a test holds every mission to it. Caesar may now ask those provinces for marble
* Saves: version 32 (an older save's Peristyle Villas and up start with 6 months of marble)
* Headless sim, sweep and capacity: identical to v0.19.9 (the demo towns never reach the Marble Villa)
* 1070 unit tests, 213 browser checks

## Done (v0.19.9)

* **Shift+1 to 9 pick up a fort's standard where you are looking**: one press opens fort N's panel and puts its standard in hand (deploy mode), without moving the view, so the next click on the map sends its men there; pressed twice quickly, the view glides to its standard (deployed) or the fort (playtest: the keys glided to the fort, which is what the player wanted to avoid)
* 1052 unit tests, 210 browser checks

## Done (v0.19.8)

* **Ceres's blessing is a real bumper harvest**: every farm brings in a whole harvest (a load) at once, over what is growing, full or not, staffed or not, and the message says what came in. It used to set the fields nearly ripe, which a full farm or one without workers never harvested (playtest: it did not work)
* Headless sim: every level identical to v0.19.7; the uptown run's one Ceres blessing moves its granaries a load
* 1052 unit tests, 209 browser checks

## Done (v0.19.7)

* **The arenas stay inside their squares**: the Great Arena and the Amphitheater were drawn as ellipses too wide for their footprint's diamond and spilled past it on the diagonals; the Great Arena's flags now stand on its far rim
* 1051 unit tests, 209 browser checks

## Done (v0.19.6)

* **Disease outbreaks are easy to see**: a sick home carries a round green sign with a cross over its roof (drawn like the no-road sign, readable zoomed out, by night and with an overlay on), and its panel opens on a red "Disease outbreak" note with the days left, the risk to its neighbours and what cures it (playtest: the pale house and a line deep in the panel were easy to miss)
* 1051 unit tests, 209 browser checks

## Done (v0.19.5)

* **A missed call for troops is softer**: nobody sent costs -25 favor (was -50), only -10 if the city had no soldier or ship at all to send, and a lost distant battle never by itself drops favor to the legions' mark (playtest: one missed call took favor from 55 to Caesar's legions)
* Headless sim: every level identical to v0.19.4; the 8-year frequent-raid run, which ignores its call for troops, ends at favor 45 (was 30)
* 1051 unit tests, 208 browser checks

## Done (v0.19.4)

* **Soldiers on the march fight raiders they meet**: deployed soldiers on their way to a far rally point walked past raiders, struck or not; now an enemy within half a soldier's sight of him (4 tiles for a legionary) is fought, then he marches on
* Headless sim: every level and the raid runs identical to v0.19.3
* 1051 unit tests, 208 browser checks

## Done (v0.19.3)

* **One god's wrath a month**, the angriest first: neglected gods all struck in the same month (playtest)
* **The engineer's post has a door** on the front it turns toward its road (it turned, but nothing showed it faced the street)
* **The top bar fits smaller screens**: when it is full it drops, a step at a time, the season's name, then the city's name, the Advisors' label and the Overlays list's width, then the view-turn arrows and the messages button (a 16-inch laptop cut off the Advisors)
* 1050 unit tests, 208 browser checks

## Done (v0.19.2)

* **A fountain with no workers shows its reach** while fountains or homes are placed, in a muted grey-blue: it showed nothing, and read as a fountain with no reach (playtest: a fountain with no homes in labor range)
* **Province mode on the main menu**, greyed out, "coming soon" (see the roadmap)
* 1049 unit tests, 208 browser checks

## Done (v0.19.1)

* Monuments, fixes from a second review: a Lighthouse's panel says whether it is open before any note about a low bridge; a halted site pays nothing for its next stage until it goes on; a monument cart cut off on its way takes its load to storage instead of losing it
* Headless sim: every level identical to v0.19.0
* 1049 unit tests, 208 browser checks

## Done (v0.19.0)

* **Monuments** (after Augustus's, rebuilt as Colonia's own): six great works, only one a city, from campaign step 6 (the Pantheon from step 8; all in the sandbox), each built in stages from a Castra Operarum (Work Camp: 3x3, 300 Dn, 40 workers) whose carts bring the goods from the warehouses and whose crew builds once a stage's goods are all in. The camp works at half pace without food or without water, and stops without both. A sensible city takes 1.4 to 3.1 years and 4,400 to 9,800 goods
  * **Fanum** (Great Sanctuary) to one god: counts as 6 temples and the god never strikes, with that god's gift (Ceres farms +20%, Neptune fish +50% and health, Mercury homes use a fifth fewer goods, Mars smaller warbands and stronger soldiers, Venus home mood +10)
  * **Pantheum** (Pantheon): 2 temples for every god, no jealous god, no festival neglect
  * **Pharus** (Lighthouse, by the sea): sea quotas +25%, storms at sea half as long
  * **Mansio Magna** (Caravanserai, two land partners or more): land quotas +25%, caravans carry 1,200, land disruptions half as long
  * **Thermae** (Great Baths): baths for every home within 24 tiles, health +10, disease slower
  * **Basilica** (Hall of Justice): taxes +20%, crime -30%, prosperity +8
  * Finished, a monument needs most of its staff and pays upkeep; it never burns or collapses. Raiders set a site back once a raid (half the stage's work, a quarter of its goods) and sack a finished one until it is repaired; **on Insane they raze it**, and another may be started. +150 to the Hall of Fame. The machinery (stage tables, the camp, upkeep) is built to carry Nova Roma's palace later
* Saves: version 31
* Headless sim: every level identical to v0.18.15 (the demo city builds no monument; `npm run sim -- --monument <key>` builds one)
* 1048 unit tests, 208 browser checks

## Done (v0.18.15)

* **A new city's keenness fades instead of ending as a cliff**: the settlers' extra mood (+20) and numbers (1.6 times) stay full for 9 months, then fade evenly over 6 (the same 12 months' worth); at month 12 the city lost 20 mood overnight
* **A save keeps its desirability**: the running game works desirability out only when the map changes, and a load did a fresh pass, so a loaded game could differ from the one saved. The layer is saved (byte planes, so an Uber save stays small) with whether a pass is due; older saves get the fresh pass
* **The ship bridge**: the camera follows a walker up onto the deck, and a ship's lantern under the deck no longer shines through the stone
* **A ship's trip to the Portus** is timed by its route on the water, not the straight line
* Headless sim: Easy, Normal and Hard end the same as v0.18.14; Insane peace 24 (was 23)
* 1010 unit tests, 204 browser checks

## Done (v0.18.14)

* **Homes join into blocks without stranding a single home**: a home joins a 2x2 block as any corner of it, blocks are laid from the west and north end of each run of single homes so they line up (a run two deep and six long becomes three blocks; seven long leaves only the last column), and 1 square in 5 (not 1 tile in 3) stays four homes for variety. Growing and splitting keep the singles around able to pair
* Headless sim: Normal ends with 680 people (was 648), ratings within a point; Insane peace 23 (was 21)
* 1008 unit tests, 204 browser checks

## Done (v0.18.13)

* **Waterside buildings stand out over the water**: a 2x2 (the Fishing Wharf, the Shipyard) has its front row on the water, a 3x3 (the Emporium, the Navalia, the Naval Station, the Portus) its two front rows, each drawn as a pier, quay or slipway on piles; ships moor just past the front. The water under them is closed to boats (they sail round), a building that would cut a channel in two is refused, and demolished, burned or undone the water opens again. Older saves keep their buildings on land. Every coastal mission keeps spots for each waterside building (25 to 70 for the Emporium)
* Saves: version 30 (an older game refuses a newer save rather than sail through its piers)
* Headless sim: every level identical to v0.18.12; the harbor, fishing and navy showcases moved with their new spots
* 1005 unit tests, 204 browser checks

## Done (v0.18.12)

* **More room along the Imperial road**: no rock or meadow within 8 tiles of it (with a ragged edge out to 10; was 6 to 8), so a city's first blocks have open ground. Every map is new; the default sim's demo town now fits its industry (171 jobs, was 127) and ends with peace 56 (was 33) at about the same 630 people
* **No road under the aqueduct tile beside a reservoir**, where the channel steps down into it, and no reservoir beside a road under an aqueduct
* The demo city adds its second reservoir where it reaches the fountains the first one misses
* 995 unit tests, 204 browser checks

## Done (v0.18.11)

* **Jealous gods** (the original's rule, Venus included): in a city of 800 people or more, the god with strictly the most staffed temples (a large one as two) is the favourite, its mood target lifted to 100 (or by 50 if under 50), and the god with strictly the fewest is jealous, its target 25 lower; a tie means neither. The Religion advisor marks both
* **Falling snow is half see-through** (was 0.8 opaque)
* Headless sim: every level identical to v0.18.10 (the demo cities build their gods' temples evenly)
* 994 unit tests, 204 browser checks

## Done (v0.18.10)

* **Soldiers heal in their fort** (Colonia's own): a wounded soldier resting in his fort's yard heals from nothing to full in 30 days, and a liburnian at its berth mends its hull at the same pace; nobody heals while deployed, standing to or marching
* Smoke test: the fire checks follow a home by its tile (a home that merged into its neighbour's left the check waiting) and step the game tick by tick to see a prefect at work
* Headless sim: every level identical to v0.18.9
* 992 unit tests, 204 browser checks

## Done (v0.18.9)

* **Festivals count priests**: a bigger feast needs more priests among the god's staffed temples, a temple having 1 and a large temple 2: a small festival needs 1 (a large temple alone will do), a large one 3 (a temple and a large temple, two large, or three temples), a grand one 3 and an Oracle. Where a province has no large temples, three temples hold a large festival
* Headless sim: every level identical to v0.18.8
* 991 unit tests, 204 browser checks

## Done (v0.18.8)

* **A high ship bridge**: the Pons stands 33 px over the water on stone arches with cutwaters, so a merchant ship's mast passes under it, and ramps down to the land road at each bank (over a tile and a half, starting mid-tile so a side road meets it level); walkers, carts, soldiers and rally flags follow the ramps. The low bridge gets short ramps over its first and last half tile
* **Untrained soldiers go to train**: a fort at rest sends one untrained man at a time from its yard to the nearest fully staffed Military Academy a soldier can walk to; he trains 16 days and comes back trained, never leaving the fort's last man behind. A raid, a deployment or a distant battle calls him back at once. Ships at their berths take turns at the Portus the same way. The fort panel says "5 of 8 trained, 1 at the Campus"
* **Nobody is shut inside a new building**: soldiers, raiders, wolves, villagers and anyone waiting off the roads step aside when a building or wall goes up where they stand
* Saves: version 29 (a soldier on a trip in a save from before version 16 comes home untrained)
* Headless sim: every level identical to v0.18.7 (the demo city never fully staffs its academy)
* 991 unit tests, 204 browser checks

## Done (v0.18.7)

* **Fires are fought one building at a time**: a prefect stands at one burning building for half a day, throwing water, then takes the next within 4 tiles that nobody fights, or runs to the nearest within 24; the fire keeps spreading from every building still burning meanwhile. One prefect is called per burning building, and a prefecture with 3 of its own on fire duty sends no more (the next in reach does). A burning ruin's panel says when a prefect is putting it out
* Saves: version 28 (an older save's fires are grouped by the ruin they share)
* Headless sim: every level identical to v0.18.6 (0 or 1 fire in those runs); across the sweep fires went from 584 to 530, and with frequent raids more prefects die answering the fires raiders set (21, was 15) with the same buildings lost
* 973 unit tests, 202 browser checks

## Done (v0.18.6)

* **Salary up to your rank**: ranks above the governor's are shown greyed out and cannot be picked; a lower salary still earns favor at New Year. An older save paying above its rank drops to it on load, and what was drawn above it since New Year goes back to the treasury
* **Festivals need temples** of the god honored, staffed: a small festival a temple, a large one a temple and a large temple, a grand one both and an Oracle. A size the city cannot hold says why, or that the province has no large temples or oracles
* **The Senate (Curia) from mission 2**; Figlina asks for 1,400 people (was 1,350) to stay at 85% of its jobs
* **A building faces the road**: held with a road along exactly one side, it turns its front to it; R takes over until another tool is picked
* **Waterside buildings at the water's edge**: docks, wharves, shipyards, the Navalia, naval stations and the Portus need one whole side on the water, with no land between (older saves keep theirs)
* **A fort or station with men away cannot be demolished** (clear tool, panel and undo): recall them or wait for them to come home
* Headless sim: every level identical to v0.18.5
* 962 unit tests, 201 browser checks

## Done (v0.18.5)

* **Soldiers rest inside their fort**: at rest a fort's men stand in its yard among the tents, in and out by its gate; while raiders, Caesar's legions or a revolt are on the map they stand to at their old places outside and fight as before (in scripted raids, as many raiders slain or more, and the same buildings lost)
* **Figures beside buildings can be clicked**: a click test of what is actually drawn in front of a walker or soldier, where it treated each building as a box as tall as its flag poles (a recruit training at the Military Academy could not be clicked)
* **Campaign goals** (from playtest): a favor goal from step 3 (Figlina and Firmum 30, Pons Aelius 35), and the peaceful province asks for about a fifth more people than its military partner at every step from 3 (Figlina 1,350, Paestum 3,350, Beneventum 4,800; Portus Mercatorum 3,900, kept within Oasis Aurea's pace). Figlina gains Capua as a partner and buys more pottery, Beneventum's partners buy furniture, clothing, meat, wine and pottery; a mission in progress takes the new goals and an older Figlina save gains the Capua route
* Soldiers at rest no longer police the street outside their fort: in the Insane garrison run 23 criminals were caught instead of 29, and peace ended 44 instead of 45
* Headless sim: Easy, Normal, Hard and Insane identical to v0.18.4
* 944 unit tests, 196 browser checks

## Done (v0.18.4)

* **Gardeners** (Colonia's own): the Topiaria (Gardeners' Yard, 35 Dn, 4 workers) sends gardeners who tend every garden and statue within 2 tiles of their road. Untended, a decoration keeps its full desirability for 16 days, then fades a step every 20 days to a floor of 25% (half as fast on Easy, half again on Insane), and a visit restores it. The Gardens and statues overlay shows their care, and a faded garden looks dry, a faded statue dull. Plazas, the arch, the residences and the Oracle never fade; where a mission has no yard, nothing fades
* **Festivals cost goods** (wine as in the original, food Colonia's own): food from the granaries (5%, 10% or 20% of a month's food, at least one load), and for a large or grand festival wine from the warehouses (grand the original's population / 500 + 1 loads, large half). All or nothing, with the reason when something is short. The wait after a small festival is 2 months (was 3), a large one 4 (was 5), so five gods can be honored in turn; a festival within 3 months of the last lifts the city's mood only in part
* **The gods mind being forgotten** (the original's rule): a god without a festival for more than a year has its mood target lowered a point a month, at most 28, in a city of 800 people or more; the Religion advisor shows each god's last festival and when it is neglected
* Saves: version 27 (an older save's decorations start tended, its gods on a fresh year)
* Headless sim: every level identical to v0.18.3 (the demo towns stay under 800 people and build no decorations); new lines report the gods and the gardens
* 930 unit tests, 193 browser checks

## Done (v0.18.3)

* **Numbered forts and their keys**: each fort takes the lowest free number (Castra III), shown on its panel, in the Military advisor and over its deployed standard. Shift+1 to 9 glides to that fort and opens its panel, and again to its standard when deployed; F deploys the fort or naval station whose panel is open
* **Rally flags you can click and drag**: a click on a deployed standard or squadron flag opens its panel with Recall; a drag moves it, with a ghost that turns red where it cannot stand (the Deploy click's ghost does too). A drag never pans the map, and a drop off the map or over a panel leaves it where it was
* **Troops sent to a distant battle leave at once**: walking to the map's edge took longer than some marches, and the march months stand for the whole way
* Saves: version 25 (an older save numbers its forts in the order they were built)
* Headless sim: every level identical to v0.18.2
* 896 unit tests, 190 browser checks

## Done (v0.18.2)

* **A switch per event in the sandbox**: the setup's Events box ticks or clears six switches below it: Rome's wage (rise and cut together), land trade stopped, sea trade stopped, bad water, mine collapse, clay pit flood. A month that draws a switched-off event brings nothing, so the others keep their odds. Missions keep their designed events, and the Hall of Fame scores missions only, so the switches never touch a score. URL flag `events=wages,sea` and `npm run sim -- --events wages,clay` take a list
* Saves: version 24 (an older sandbox gets every switch on if its events were on, none if off)
* Headless sim: every level, with events on or off, is identical to v0.18.1
* 873 unit tests, 184 browser checks

## Done (v0.18.1)

* **Events** (parity #9): each month one draw from the original's table, by each mission's switches (missions 1 and 2 have none; the sandbox has them all, with a switch): Rome raises or cuts its wage (the wage your mood and prosperity are measured against), land or sea trade stops for 48 days, bad water, the oldest iron mine or clay pit is lost. Scheduled in some missions: an earthquake whose cracks turn tiles to rock over days (the Imperial road always holds), a new Caesar (favor back to 50), price changes, and a gladiator revolt in Urbs Magna and Puteoli where a gladiator school works. Neptune's wrath also sinks merchant ships under sail. Half as often on Easy, half again on Insane
* **Enemies by region** (parity #21): raids come from the province's own people, by mission or by its place on the empire map: Gauls, Boii with war chariots, three Ligurian peoples, Carthaginians with elephants that shrug off missiles, Lusitanians, the Cimbri and Teutones; each with its own warriors, target and breaking point, and their slingers and javelin men strike walkers while the city has fewer than 4 soldiers. The sandbox keeps the generic warband unless its setup picks the province's people
* **Wolves** (parity #19): packs of 6 to 8 from dens in the woods in Firmum, Pons Aelius, Mutina and Narbo Martius (and the sandbox by switch) hunt walkers nearby, grow back while any survive, and are cleared by soldiers, towers and prefects
* **Two kinds of bridge** (parity #25): the Pons stays the ship bridge (100 Dn a tile, at least 3); the Pons Sublicius is a low bridge (40 Dn, 1 to 16 tiles) that stops every boat; placing one names what it cuts off, and ships and liburnians on the far side go to their own water's station or are laid up
* **Native villages** (parity #20): in Mutina and Luna (and the sandbox by switch), angry until calmed: a building on their land sets off an attack. A missionary from a Sacellum Pacis calms the villages in reach for 100 days, and calmed villages send a trader every 9 days to buy exports
* **Hall of Fame** (parity #22): a score for every won mission (ratings, people against the goal and the pace, by difficulty, with battles won and raids repelled), the best ten and the career, kept in the browser, from the main menu, the campaign and the victory screen
* **Prefects fight wolves and attacking villagers** as they fight raiders
* Fixed: the menu's city opened at night every time (80 days ended at nightfall); it opens in the morning
* Saves: version 23 (older saves load with none of the new state)
* Headless sim: with events off (`--events off`) every level is identical to v0.18.0. With the sandbox's events on, each 3-year run draws one to three events, always a rise in Rome's wage, which the demo city never matches, so its prosperity ends 8 lower (a player raises the wage)
* 867 unit tests, 182 browser checks

## Done (v0.18.0)

* **Rotate buildings**: R (or the turn button) turns the building in hand; every building's art is drawn turned whole (temples, the theater, the arch and others fixed by hand), the hippodrome can run north-south, and the turn is saved with the building, kept for Rebuild and remembered per kind for the session. Waterside buildings and the triumphal arch face their water or road and do not turn. Saves: version 22 (older saves load unturned)
* **Rotate the view** (parity #7): Q and ] turn the city clockwise, Shift+Q and [ back, with turn buttons and a north needle on the top bar; the tile in the middle stays put. Terrain, roads, walls, aqueducts, buildings, walkers, soldiers, ships, overlays, the placement ghost, clicks and drags all follow, and the minimap turns with the view. Frame times within 2% of the unturned view
* Headless sim: every level identical to v0.17.4
* 755 unit tests, 167 browser checks

## Done (v0.17.4)

* **Auto-pause on events**: six switches in Settings pause the game when a fire breaks out, the scouts report a raid (or Caesar's legions set out), raiders or legions arrive, Caesar makes a request or calls for troops, a building collapses, or disease breaks out. Only "raiders or legions arriving" is on at first. A note says what paused the game; a click on it goes to the place, the empire map or the Imperial advisor
* **Cycle buildings of a kind**: a building's panel has previous and next buttons (keys , and .) for the others of its kind and a Next idle button; I and Shift+I step through idle buildings of every kind, also from the Production advisor
* Headless sim: every level and the raid, garrison and harbor runs identical to v0.17.3
* 714 unit tests, 155 browser checks

## Done (v0.17.3)

* **Trade by partner**: each good a partner buys or sells has a switch beside its price on that partner's route card (in the Trade advisor and on the empire map), all on by default. A good trades with a partner only if its Import/Export setting allows it and that partner's switch is on, so you choose whom to sell to and whom to buy from; the Goods table says "to 3 of 5 buyers", and a partner with every good switched off sends nobody. The trade log names what each visit sold and bought. Saves: version 21 (older saves load with every switch on)
* Headless sim: every level and the harbor runs identical to v0.17.2
* 697 unit tests, 145 browser checks

## Done (v0.17.2)

* **Trade prices vary** (Colonia's own; the original had one price table): a good's price with a partner is its base price x the province's market x this year's drift x the partner's distance. The nearest partner trades at base and the farthest at 25% more, both ways (imports cost more, exports earn more); every trading mission has a market of 2 to 4 goods cheap or dear there (wine cheap at Cosa...); and at each New Year every good drifts, pulled halfway back toward its base plus a step of up to 10%, never past 15%, with a message naming the biggest moves (seeded by the map and the year, never saved, the same after a load). Route cards, the goods rows, the dock, ship and caravan panels, the empire card and the briefing show the prices. With the harbor demo: exports 4,171 to 4,498 Dn a year, imports unchanged; where a province's main seller is its farthest partner (Figlina, Firmum, Oasis Aurea) buying costs more
* 685 unit tests, 143 browser checks

## Done (v0.17.1)

* **Your province sits where it was**: each mission's province has its own place on the empire map (Firmum in Picenum, Paestum, Beneventum, Cosa, Copia, Mutina, Luna, Corduba up the Baetis, Carteia by the strait, Narbo, Puteoli; Pons Aelius and Urbs Magna stay on the Etruscan coast), and the sandbox setup offers a choice of six. Trade routes are worked out from there over a network of roads and sea lanes (the twelve Etruscan routes come out exactly as before), and distance now sets trade times (Colonia's own rule; in the original it did not): a trader takes half a day per map unit each way, a quiet route sends one no more often than a round trip, a busy one still often enough to sell its year, and the first comes once it has made the trip. Seven routes slow down, Alexandria's ships to Corduba from 2.4 a year to 1.9. Distant battles march along the new routes (Corduba's Italica battles: three months), raids and legions come from the new home's directions, and each route card shows its days on the road
* Headless sim: every level and the capacity and pace runs identical to v0.17.0; the coast harbor run's first ship comes after its trip (13 to 14 ships in 3.5 years)
* 671 unit tests, 141 browser checks

## Done (v0.17.0)

* **The campaign runs to step 10, a peaceful and a military province at every step from 3**: Cosa (peaceful, lakes 144, 5,600 people) beside Oasis Aurea at step 6; Copia (peaceful, river 160, 6,000) beside Urbs Magna at step 7; Mutina (military, plains 176, 6,000) and Luna (peaceful, coast 176, 7,000) at step 8; Corduba (military, river 192, 8,000) and Carteia (peaceful, coast 192, 9,500) at step 9; Narbo Martius (military, river 256, 10,000) and Puteoli (peaceful, coast 224, 12,000) at step 10. Every goal is 85 to 90% of what a sensibly built city of its buildings employs (`npm run sim -- --capacity`), with trade demand on the original's tiers; the missions grow longer step by step (6.5 to 15.4 years at the fastest). One rank a step, Procurator at 6 to Proconsul at 10; winning step 10 makes you Caesar
* **Step 10 is a city of districts**: its maps put the meadow, the woods and the rocky hills each in an area of its own, 81 to 125 tiles apart, and a building hires only within 40 road tiles, so the city must grow a district by each
* Fixed: raider and legion pathfinding on a big forest could grow without limit (it crashed a 256 map run); one city's name on a crowded empire map could print over another's; a land-only mission's raids could still come by sea when Sea raids was on
* Headless sim: every level and the raid, garrison, legion, navy and harbor runs identical to v0.16.5
* 653 unit tests, 138 browser checks

## Done (v0.16.5)

* **Jobs for big cities, measured** (the ground for steps 6 to 10): the capacity model (`npm run sim -- --capacity`) now plans a small villa quarter (5% of the people where homes can reach the Villa: they use services, food and goods but do not work), food by each kind eaten, docks by ship traffic and the hippodrome once. The 5% comes from play: the demo city with wine for every market or villa blocks (new sim flags `--blocks`, `--villas`, `--wine`, with a capacity check against the model) averaged 4% in villas. Measured against play the model is cautious (a block had 505 to 525 jobs where it plans 396 to 440). Missions 4 to 7's ceilings rise from 2,850 to 6,450 to 3,460 to 7,900; a late province with every building and most of twelve partners comes to about 11,000 to 13,600, so the last steps can ask for 10,000 people. Goals unchanged
* **Trade on the original's tiers**: a mission can set what each partner buys (1,500, 2,500 or 4,000 a year) and schedule changes, each announced in its month; a route busier than its traders can carry sends them more often. New sea partners Gades, Rhodus and Delos in the sandbox and on the empire map (no mission uses them yet)
* Headless sim: every level and the harbor run identical to v0.16.4
* 648 unit tests

## Done (v0.16.4)

* **Service walkers head for the homes that need them**: priests, teachers, librarians, scholars, barbers, physicians, bath attendants, entertainers, market vendors and tax collectors chose junctions by chance, and homes on a building's far street waited months (a mission 2 playtest: Stone Cottages on a school's far street). At a junction each is now drawn to the way whose neediest home most needs his visit (its access running out; for a vendor, a pantry low in what his market stocks), looking past the next junction up to 8 road steps and only at homes within 13 tiles of his building. Tax collectors, priests, barbers, physicians and bath attendants also set out on the next round as the last turns home. Measured over 6 seeds and 720 days: the mission 2 playtest city went from 85,494 home-days without a service it needed (the longest wait 505 days) to none; the demo city from 212,326 (560 days) to 6,267 (208). Headless sim over 32 map seeds: population flat to +8, homes moving down 10 to 17 fewer, culture about +1.5, prosperity +5 to 6. On Insane the demo city's 28 to 36% unemployment keeps its mood under 45, so its peace stays low (26 to 25); sized to its jobs, Insane peace rises (44 to 47)
* 636 unit tests

## Done (v0.16.3)

* **A deployed fort takes no recruits**: a fort or Naval Station with a rally point, or with men or ships away at a distant battle, takes no new soldiers (and the Navalia builds it no liburnians) until it is recalled and home; one already on his way still joins. Before, new recruits joined a deployed fort and stood about the city
* **Recall from a distant battle**: a Recall button on the fort and station panels and in the Imperial advisor. A rider carries the order (half the months already marched, at least one); the men march on until he reaches them, then come home taking as long as they had marched out. Men recalled before the battle no longer count for it; recalling everyone counts as nobody sent. The empire map shows the rider and the men coming home. Saves: version 19
* **Horses live at the Horse Ranch**: a ranch keeps up to 8 horses and stops foaling when full; a groom leads them straight to a barracks while forts need cavalry; warehouses never hold horses. Ships and caravans buy from and sell into ranches (no ranch, no horse imports); the Emperor asks for horses only while a ranch stands, in whole horses, never more than the ranches hold. Older saves' warehouse horses move to ranches with room. Saves: version 20
* Headless sim: Easy, Normal, Hard and Insane identical to v0.16.2
* 632 unit tests, 133 browser checks

## Done (v0.16.2)

* **Missions 3 to 7 can be won**: they asked for 3,500 to 12,000 people, more than their buildings could employ (`npm run sim -- --capacity`: about 980 to 6,060 at 10% unemployment), and a Pons Aelius playtest met every goal but its 5,000 people. Each now asks for a little under its job ceiling, as the branch missions do: Figlina 950, Pons Aelius 2,700, Portus Mercatorum 4,600, Oasis Aurea 3,500 (its peace goal 70, from 65, so it stays longer than step 5), Urbs Magna 5,800. Their planned pace is measured again (2.5, 2.9, 5.1, 4.2 and 6.8 years at the fastest), and the campaign test holds every mission to its jobs, with no exceptions left. Saves keep their city and take the new goals
* **Liburnians fight the raider ships they meet**: one rowing to its deployment point sailed past a raider ship far from both its station and that point; now any raider ship within its reach is fair game, chased while it stays close
* **Raider ships are clickable over buildings**: a click on a ship's hull picks the ship even where a building stands on that tile (a raider ship off the shore sits over the buildings it attacks)
* 605 unit tests

## Done (v0.16.1)

* **The shipyard needs timber** (Colonia's own; the original's built boats from workers and time alone): a fishing boat takes 100 timber, used at its launch; the yard holds up to 200, carts bring it as they bring a workshop's raw material, and the work waits while the yard holds less than 100. Its panel, the wharf, the Production advisor and the placement preview say when timber is missing. Every mission with a shipyard has a timber yard and woods for it (Paestum and Portus Mercatorum have no partner selling timber). Saves: version 17
* **Prefects stand up to enemies close by**: a prefect on his rounds fights a raider or one of Caesar's legionaries on land within 2 tiles, holds while it stays within 3 and goes back to his rounds; never while fighting a fire or chasing a criminal, never across water or walls, never a fleeing or waiting enemy. He is a watchman, not a soldier (40 hp, attack 5, defense 2): he slows a warband and often dies doing it, and his prefecture sends the next after its usual 3 days. Prefects lost show in the Military advisor
* **Soldiers cross by the bridge**: a soldier going after an enemy across a river planned a route only after a day stuck on the bank; now he checks the straight way and takes the bridge (or a gate) at once
* Headless sim: Easy, Normal, Hard and Insane identical to v0.16.0; with frequent raids and no soldiers, 2 to 3 prefects die in a 6-year run without changing the raids' outcome; Insane raid runs with a garrison over six seeds, 84 raiders slain and 20 buildings lost before, 85 and 19 after
* 603 unit tests, 131 browser checks

## Done (v0.16.0)

* **Forts at rest hold their ground**, as in the original: an undeployed fort's legionaries and cavalry fight only an enemy within 2 tiles of its ranks, step out to strike and fall back, and its archers shoot only from their posts; anyone fights back against an enemy striking at him. Deploy a fort to meet raiders in the field. Before, an undeployed fort charged anything within 14 to 26 tiles. The headless sim's garrison mode now deploys its forts onto the enemy nearest the city and recalls them, as a player would
* **Training takes time**: a recruit stays 16 days at the Campus (Military Academy), and a new liburnian 8 days at the Portus, the days counting only at full staff (a pupil waiting more than 32 days goes on untrained); his place in the fort is kept. Soldiers and ships at rest no longer go off to train. The fort, academy and Portus panels show who is training and the days left
* **Bridges ships pass under**: a stone bridge with a pier under each tile and its deck 10 px over the water; a ship on a bridge tile is drawn under the deck, and people crossing are drawn on it (the deck was ground, and ships sailed over it)
* Saves: version 16 (training in progress); older saves load
* Headless sim: Easy, Normal, Hard and Insane identical to v0.15.9
* 581 unit tests, 130 browser checks

## Done (v0.15.9)

* **More fishing grounds**: at one ground per 250 tiles of water, at most 4 on one water and the original's 8 on a map, a whole coastline had 4 grounds and most rivers 1 or 2. Now one per 150 tiles, up to 10 on one water and 10 tiles apart, and the map's limit grows with its area (8 on a 96x96 map, up to 24). A 128 coast has about 10, a 128 river 4, Firmum's lakes 6 (from 4). Grounds come from the terrain, so older cities get them as they load. Headless sim: every default run identical; with two wharves the coast town lands about 1,800 fish a year (from 1,500) and the river town about 1,170 (from 670), its boats sailing shorter
* 574 unit tests

## Done (v0.15.8)

* **Roads and aqueducts cross at right angles**: a road could run along under an aqueduct. Now a road passes under an aqueduct only straight across it, through one arch, and neither turns, branches nor runs along on the crossing tile; an aqueduct may not run along or turn over a road either. Refused tiles show red with the reason; roads already under aqueducts in an older city stay. Headless sim identical on every level and on the campaign maps that lay aqueducts
* 574 unit tests

## Done (v0.15.7)

* **Raid warnings as the enemy closes in** (parity #24): the original warned three times as an army drew near; Colonia's raids now get three warnings too. About 6 months out traders speak of a warband (only the months; not under 300 people); at 3 months the scouts report its size, side and whether it comes by land or sea, as before; a month out a last warning names the side again (and, by sea, the landing, looked for again: with no landing the warning says they come overland). Caesar's legions remind you halfway through their 12-month march and a month out, each time saying what today's favor would make them do. The first warnings open the empire map with the warband or the legions picked out; the last glides to the place. A raid dated late skips the stages already past; a save from before loads with the stages whose moment has passed counted as given
* **Waterside buildings face their water**: an Emporium, a Naval Station or a Portus could stand turned the wrong way (and the placement preview of the ship buildings always showed one edge), since their side was worked out only when a ship first came. Every waterside building is now turned to its water in the preview, as it is placed, and as an older save loads
* Headless sim: Easy, Normal, Hard, Insane and the raid and legion runs identical to v0.15.6 apart from the new warning messages
* 573 unit tests, 129 browser checks

## Done (v0.15.6)

* **The victory music ends with the victory screen**: a won mission plays festival music to celebrate, and "Keep building" left it on for the rest of the game, so a festival held afterwards changed nothing (mission 3 playtest). Closing the screen now gives the music back to the city
* 128 browser checks

## Done (v0.15.5)

* **Soldiers, raiders and Caesar's legionaries are clickable**: only walkers and ships were. A click on one opens its panel: health, what it is doing, its arms, and for a soldier his fort (and whether it is deployed), his training and his pay
* **No victory with enemies in the province**: a mission 3 playtest was won with raiders on the map. With raiders ashore or in their ships off the coast, or Caesar's legions, Rome now waits (a message says so once) and proclaims the victory at the first month's end after they are gone
* **Peace falls while enemies are in the province**: the playtest's peace kept rising with a warband at the walls. In a month when enemies were in the province peace gains nothing and falls 2. Headless sim: every default run identical to v0.15.4; Insane with frequent raids and a garrison over 6 years ends at peace 26 instead of 56 (Caesar's legions spent months in that province)
* 554 unit tests

## Done (v0.15.4)

* **Ships waiting for a free Emporium are shown**: a ship stays 2 to 7 weeks, so a city with several sea partners keeps one Emporium busy, and a ship that found every staffed Emporium taken turned back and tried again 6 days later without a word. Now its route is marked waiting, and the Emporium's panel and the Trade advisor say which partners' ships are waiting offshore and that another Emporium would take them in
* 552 unit tests

## Done (v0.15.3)

* **The governor's residence needs servants** (Colonia's own; the original's needed no workers): the Praetorium 4, the Praetorium Maius 8 and the Regia 12, Government labor like the Forum, so it needs a road like any building with workers. It gives its desirability only as far as it is staffed: an unstaffed residence is a shuttered house that adds nothing. Its staffing changing works the desirability out again at once (it is otherwise worked out only when the map changes)
* 551 unit tests

## Done (v0.15.2)

* **Lighter snowfall**: about a quarter fewer flakes (one per 4,000 px of screen at full snow, from 3,000) and a little see-through, so falling snow no longer reads as a blizzard over the city. The snow on the ground is unchanged
* 550 unit tests

## Done (v0.15.1)

* **Fountain water is easy to see while you build**: with the Housing tool the fountains' area had a pale fill and a thin, half-clear edge that vanished over a housing block; it now has a clear blue edge two pixels wide. Placing a fountain now also shows where the fountains already give water, even with the cursor off the map (it showed only the reservoirs' piped area there), and their edge is stronger while the new fountain's area is shown
* **Meadow shows through the snow**: in winter snow hid the meadow's colour, so the land a farm could use looked like any other. With a farm (or any building placed on meadow) in hand, meadow is now tinted green-gold with a clear outline, in every season
* 549 unit tests

## Done (v0.15.0)

* **Campaign branches** (parity #13, the first three): after a win you choose your next province, a peaceful or a military one, both at the same rank, and may switch tracks at every choice; a city that is overrun is offered the same step's choice again. Three new provinces, all Roman colonies of the 270s and 260s BC: **Firmum** (military, step 3, beside Figlina), a frontier hill town against the Picenes with a legion fort and the Campus a step early, raids from its second year and a call for troops for Ariminum; **Paestum** (peaceful, step 4, beside Pons Aelius), an old Greek city of temples trading by sea; **Beneventum** (peaceful, step 5, beside Portus Mercatorum), a market town on the Via Appia. Their population goals fit their jobs (`npm run sim -- --capacity`): 1,100, 2,700 and 3,000 people; peace sets their pace (2.3, 3.75 and 4.2 years). Savings go to both provinces of the next step
* The campaign's pace rule is per step: a mission is no shorter than the shortest of the step before
* Headless sim: Easy, Normal, Hard and Insane identical to v0.14.0
* 548 unit tests, 127 browser checks

## Done (v0.14.0)

* **Caesar's legions** (parity #1): favor at 0 no longer recalls the governor. At favor 10 or less Caesar warns and, 12 months later, sends his legions (16, 32, 48, then 72 imperial legionaries, times the raid lever, at most 75), shown marching from Rome on the empire map. They go for the governor's residence, then the best homes. Favor recovering past the difficulty's band sends them home, a middle band halts them, and only destroying them earns +10. A mission is lost only when the city is overrun: the legions and raiders outnumber its soldiers by more than 2 while it holds under a quarter of its peak population. A walled-in map entrance does not keep them out, a legionary leaves alone a soldier he cannot reach, and any army goes home after two years
* **Distant battles** (parity #1): Caesar asks for troops in missions 4 to 7, and now and then in a sandbox with raids on (only a city with soldiers, or ships for a city by the sea, is asked). Forts and Naval Stations have an Empire service switch; liburnians can go when the threatened city lies on a sea route (Colonia's own). The battle weighs every man and ship sent (a trained one counts more) against the enemy: a win is +25 favor and the right to a triumphal arch, too weak -10 and every man lost, too late -25, nobody sent -50. Four new cities to defend on the empire map: Placentia, Ariminum, Saguntum and Messana
* **Triumphal arches** (parity #16): free, 3x3, across a road, one per battle won; very desirable
* **The governor** (parity #6): eleven ranks from Citizen to Caesar, one per campaign mission for now (the sandbox picks one); a monthly salary, set in the Imperial advisor, paid from the treasury into personal savings that go with you from mission to mission. Paying yourself above your rank costs favor at New Year, judged on what was actually paid, and what was drawn above it in the year of victory is taken back. Gifts to Caesar now come from your savings, priced by them, each further one within a year pleasing him less; donations from savings go to the treasury. Three residences (Praetorium, Praetorium Maius, Regia), one at a time, the rioters' first target
* **Military Academy and Portus** (parity #17): recruits pass through the academy on their way to their fort, and soldiers at rest take turns; a trained legionary holding his ground takes a quarter of missile damage and gains defense, and counts more in a distant battle. The Portus (Colonia's own, after Agrippa's training harbor) does the same for liburnian crews: faster, ramming 55 instead of 45, better defended
* **Large temples** (parity #18): a 3x3 Templum for each god, counted as two temples
* **Latin names**: every building shows its Latin name (Castra, Horreum, Balneae, Excubitorium...), with the English name under it in the build menu and beside it in the inspect panel; the manual has a table of them
* Fixed: the box under the build menu grew with a hovered item's description and pushed the last item of a scrolled list out from under the pointer, so a click on it missed
* Headless sim: Easy, Normal, Hard and Insane identical to v0.13.4 apart from building names in messages (the demo city never lets favor fall, sends no troops and builds none of the new buildings)
* 537 unit tests, 123 browser checks

## Done (v0.13.4)

* **Prefects and engineers watch the whole neighbourhood**: at a junction they are drawn to the way whose buildings are closest to burning or falling down, and a post sends its next walker as the last one turns for home instead of waiting for him to walk back. In a mission 2 playtest the far street of a block six tiles from its prefecture went 165 days unvisited (a Stone Cottage burns at about 100) and five homes burned within weeks; the longest gap there is now 58 to 82 days over six seeds, and the city that lost 35 buildings in three years loses none after the homes already at the brink when it was saved. Headless sim: fires 0 on every level (Normal was 1, Hard 1, Insane 3); on Normal over five seeds fires 14 to 0, collapses 4 to 4, homes moving down 363 to 242. A hippodrome draws them too, by its risk on any of its sections
* 432 unit tests

## Done (v0.13.3)

* **Carters are clickable on their carts**: a click on a cart (or on a farm wagon and its ox) picks the carter pushing it. The click target covered only the figure, while the cart drawn ahead of him is most of what the eye sees
* 429 unit tests

## Done (v0.13.2)

* **The Health, Education and Entertainment advisors fit a phone in any font**: with wider fonts (Linux's defaults, Verdana) the Entertainment advisor's Venues table ran 15 px past a 390 px screen and scrolled sideways. On narrow screens the coverage tables now tighten and their figures may wrap. The browser check measures the three tabs in Verdana too, so it catches this on any machine (it failed on the old styles)
* **Play in the browser**: the game is published on GitHub Pages at https://er2oneousbit.github.io/Colonia/ once CI passes on the release branch (the same tested `dist/colonia.html`), and the README links to it
* On GitHub Actions a failed browser check, or a crash with the last check that passed, is written as an error annotation, public on the run's page, so a CI failure names itself (the run's log needs admin rights)

## Done (v0.13.1)

* **The info panel keeps still while you aim**: its timed refresh (every 0.7 s) now rebuilds off-screen and swaps in only when something changed. Before, the whole panel was replaced each time, so on a slow machine a button (a storehouse's order) was never still long enough to click; the browser checks failed on the CI runner for that reason
* Browser checks made sound on slower machines (run at a 4x slower CPU, 4 runs of 114/114): the snowy look may take up to 90 frames to swap in whole (more art came with v0.13.0), and the roadblock click waits until no walker stands on it
* Notes and code comments say what changed and why, in neutral terms

## Done (v0.13.0)

New advisors, the sea, cloth and a fleet.

* **Health, Education and Entertainment advisors** (parity #15): per kind of building, how many are built and staffed, the people their walkers reach and how many of the people whose homes need them they serve (Colonia's walker reach and venue seats, in twelve coverage words), with one line of advice on what holds homes back most; city health, its trend and the year's outbreaks; the Overview's health and crime lines. Click a building type to go to each in turn
* **Fishing** (parity #2): a Shipyard builds fishing boats (16 days, no materials, one spare); a Wharf's boat sails to the nearest fishing ground (where the gulls circle, found in the map's own water, never saved), fishes 4 days and brings home 100 fish, carted to a granary. **Fish is a food of its own** (a fifth kind beside wheat, vegetables, fruit and meat; no home's food need changed). Fishing goes on in an Insane winter. From mission 4
* **The hippodrome** (parity #5): a 15 x 5 racetrack (three linked sections), one per city, with a Chariot Maker sending the teams; while races run its charioteer gives homes 30 entertainment and its seats cover the whole city, and prosperity rises a little. Mission 7 and the sandbox. Measured with it, the top homes cleared their entertainment needs easily, so they rose: Grand Palatium 70 to 80, Imperial Palatium 80 to 95, which now needs a hippodrome. In missions 5 and 6 (no hippodrome) the top home is now the Grand Palatium
* **Cloth**: a Flax Farm, a Linen Maker and a Clothing Maker; **homes need clothing from the Insula up**, beside pottery, furniture and oil. Alexandria and Tarraco sell linen, Capua and Corinthus buy clothing. From mission 4. Older saves give homes of Tenement and up 3 months of clothing to start
* **Sea raids and a provincial fleet** (Caesar III had no war at sea): on maps where navigable water reaches the sea, about a third of raids come in raider ships that land their warband on the shore, throw fire pots at fishing boats and buildings by the water, then wait offshore and take the survivors home. Rome's answer is the **liburnian**, a light two-banked warship with a ram: the **Navalia** builds them from timber, iron and linen, and a **Naval Station** berths a squadron of four that you deploy like a fort's soldiers. In a scripted raid of 16 by sea, an undefended town lost about 10 buildings and 960 Dn; with a squadron about 3.5 and 320 Dn, and most raider ships sank before landing. On by default with a switch (sandbox setup and Settings) for the original's land-only raids (see Decisions). Missions 4, 5 and 7 and the sandbox
* Saves are version 11 (9 fish and the hippodrome, 10 cloth, 11 the fleet); version 4 to 10 saves load
* Measured against v0.12.2: `npm run sim` byte-identical on all four difficulties; the campaign's pace unchanged; the sweep identical for missions 4 and 5, and mission 7 (its raids now partly by sea, and the sweep's city builds no fleet) loses more to raiders: peace after 5 years 34 to 18-23
* Four browser checks that failed now and then had their causes found and fixed (a walker leaving the map mid-click, a farm needing all nine tiles of meadow, a panel read during its rebuild, a deploy click landing on the info panel)
* 428 unit tests (+87), 114 browser checks (+14)

## Done (v0.12.2)

From playtests on Normal and Insane, a 5-year sandbox save among them:

* **Dock trade as in the original** (ships traded everything the moment they arrived and left 6 days later): a ship ties up and waits while the Dock's workers carry its goods. A crane lands imports on the quay, 400 units every 3 days (paid as they land), and up to 3 dock workers (by staffing) cart them on, wherever any cart would take them, then fetch exports from warehouses within 60 road tiles and hand them aboard (paid on hand-over), 400 units a trip. The ship sails when both sides are done, after 48 days at most, or at once with nothing to trade. A full exchange takes about 18, 25 and 38 days with the warehouse 5, 10 and 15 road tiles off (the original's 23, 33 and 44). One Dock is now busy most of the year: a city trading with several sea partners does better with two (exports 4,309 Dn a year with one, 5,440 with two, in the harbor sim). The Dock's and the ship's panels show what is left to unload and load. None of the original's dock bugs (paid exports left behind, lost imports)
* **Ships at the original's pace**: every 64 to 96 days per sea route (were 32 to 56, twice the original's), carrying up to 2,400 units each way (were 1,200); caravans unchanged. On **Insane** half as many caravans and ships come in winter. A partner's distance changes nothing, as in the original; on the empire map a new route's first trader now sets out from its city instead of appearing halfway
* **The empire map is the real Mediterranean**: Iberia, Gaul and the Alps, the Italian boot with Sicily, Sardinia and Corsica, Greece and the Aegean, Asia Minor, the Levant, Egypt and the Nile, North Africa, with rivers, mountains and region names; every city where it really is (Lugdunum up the Rhone, Corinthus on its isthmus), your province on the Etruscan coast; land routes over land, sea routes over water (tests hold both)
* **A slower calendar**: a year takes 8 minutes at 1x (was 5.3), a season 2 minutes (seasons went by too fast). Nothing changes in game time; 2x-8x run faster
* **Fire, collapse and disease at the original's pace**: every fire and collapse rate runs x0.62, the original's clock (an ordinary building left unserved on Normal lasts about 10 months); disease 0.5 -> 0.2 a day at most, and a sick home now adds 0.3 a day to its neighbors (was 1, five times a Family Tent's own: in a 5-year playtest save one outbreak set off whole blocks, about 30 a year among 31 homes; replayed, about 10)
* **Later trouble**: the Emperor's first request comes 36 to 48 months in, from 500 people (was 14 to 26 months, from 150); a sandbox's first raid after 8 years with occasional raids and 5 with frequent ones (were 5 and 3). The sandbox setup said raiders need 120 people; it is 300
* **Rubble has a Rebuild button**: the same building on the same spot (a home's plots as empty lots), at the usual price plus clearing, undone like any building
* **Caravans and ships list their business**: on their way in, what they come to buy and sell; once traded, what they bought and sold here and the denarii each way
* **People are easier to click**: the walker under the pointer is taken when the button goes down (a walker moved on before the release), with a bigger target on open ground; a building or roadblock under the click keeps it
* **Baths without piped water look dry** (they were always drawn full)
* **The demo city gives every building a road** (rock or water could break one of its fixed streets: 51 of 120 menu towns showed no-road signs, and the balance sim's cities had road-less fountains). Its money yardstick moved: mission 3's town now pays its fountain workers
* Saves are version 8 (dock trade); version 7 to 4 saves load (a ship moored in a version 7 save sails on at once)
* Measured against v0.12.1 (`npm run sim`, 3 years): Normal fires 1 -> 1, outbreaks 5 -> 0, peace 33 -> 36; Hard 618 -> 669 people, fires 5 -> 1; Insane 515 -> 620 people, fires 13 -> 3, margin -3,141 -> 384. The campaign's pace unchanged in years
* 341 unit tests (+31), 100 browser checks

## Done (v0.12.1)

* **The main menu never shows the dark beyond the map** (it opened with a lot of black on the screen). Its town was built on a 64-tile map, often near the edge, and the view centered on it; the menu map is now 96 tiles and its slow tour is fitted to the screen: the town in the middle where the map allows, else the tour moves inward (keeping the town in view) and swings less, and a screen bigger than the map zooms in, fitted again when the window changes size. Probed at 1920x1080, 1280x800, 2560x1440 and a phone over six random menu maps: no screen corner off the map in five minutes of drift
* The roadmap's open lists hold open work only: done parity items leave the list (each open one keeps its number), and partly done items say what is left
* 310 unit tests (+1), 98 browser checks

## Done (v0.12.0)

Trade, storage and the gods (parity items 10, 12 and 14), and fixes from playtests of missions 1 and 2:

* **Granary and warehouse orders** (parity item 10): each good in a warehouse, and each food in a granary, is set to Accept, Refuse or Get (click to cycle), and each building has an Empty switch. Refuse and Empty stop deliveries only: markets, exports, the Emperor and other buildings' carts still take from it. Get sends the building's own cart along its roads to fetch from other storage (a warehouse keeps 5 to 8 loads, a granary fills up; never between two buildings on Get, never the last 100 units of a food); Empty sends its goods to barracks, workshops, granaries or other warehouses, a load at a time, skipping a good with nowhere to go. Room is held for every cart on its way, so nothing is lost. The info panel says what Get and Empty are doing. Nothing changes for a city that never sets an order (the sims are identical). Not copied from the original: its distance bug, lost loads, Get while emptying, one stuck good blocking Empty
* **The empire map** (parity item 12; E, the compass in the top bar, or the Trade advisor): the inland sea from Tarraco to Alexandria with Rome, your province and every partner's route; click a city for its trade card and the button to open the route. Caravans and ships travel their routes in the partner's color with the days until they arrive; a scouted warband closes in with its size, its side and the months left, and clicking it shows the map edge it will enter by. Works on phones
* **The original's five gods** (parity item 14): Ceres, Neptune, Mercury, Mars and Venus; Mercury and Venus replace Jupiter and Vesta, and every temple costs 50 Dn, each with its own roof color. **Mercury** blesses the emptiest working granary with 600 of each food; his wrath takes 1,600 units from the fullest storehouse, and angered again before he calms, burns it. **Venus** lifts every home's mood by 25 and the city's by a boost that fades; her wrath caps home moods and lowers the city's, and angered again, homes with poor health care gain disease risk. The first two missions are spared the harder wraths. Older saves carry Jupiter's temples, mood, priests and access over to Mercury, and Vesta's to Venus
* **Carts show what they carry**: sacks of wheat, crates, baskets, joints of meat, lumps of clay, logs, ingots, marble blocks, pots, amphorae (wine dark-stoppered, oil pale), furniture, shields and spears, sheaves of arrows, stacked 1 to 4 by how full the cart is; farm wagons are drawn by an ox, horses are led on a rope, and caravans' mules carry away what they bought
* **Fire and collapse at the original's balance** (fire came much faster than collapse): workshops and the timber yard now burn and collapse at one pace (they burned 1.5 to 2.8 times sooner); warehouses, engineer's posts, wells, fountains and reservoirs never burn or collapse on their own. Homes are unchanged (tents and huts still burn first, as in the original). Over 18 demo cities at Normal, fires to collapses went from 112:15 to 78:12; the sweep's mission 3 city on Normal had 19 fires in 5 years, now none
* **Mission goals that fit the jobs** (in a playtest, mission 1's 1,200 people could not be employed by its buildings, so unemployment held mood under the 45 peace needs): missions 1 and 2 now ask for 300 and 450 people, what a sensibly built town of their buildings employs at 10% unemployment, measured by play (`npm run sim -- --unlocks` builds only what a mission allows). Mission 3 unlocks the amphitheater and gladiator school, so its homes reach Domus. A test holds every mission's goal to what its buildings can employ (`src/sim/capacity.js`, `npm run sim -- --capacity`); every mission fits its jobs since v0.16.2 (see below)
* **Buildings with no road are impossible to miss**: a red no-road sign floats over any working building no road touches (and any home with no road within 2 tiles); while placing, the preview turns orange, the edge tiles where a road would serve are outlined, and the warning shows by the cursor; a building that has gone 8 days without a road says so once in the messages. Any edge touching a road works, whichever side its door is drawn on; a corner does not. (In the playtest, prefectures and engineer's posts set inside housing blocks never got workers, and the town burned and collapsed by month 7)
* **Rubble remembers** what stood there, how it fell and when: "Ruins of a Prefecture, burned down in Iul 280 BC"
* **Unemployment on the top bar** (⚒, beside the mood): amber above 10%, where it starts to cost mood; its tooltip says how much, and a click opens the Labor advisor
* **The reservoirs' piped area is teal**, so placing a fountain shows the existing fountains' reach (blue) on top of it; in the same pale blue the two could not be told apart
* **Export any save** to a file from the Save and Load menus (💾 beside each slot), without loading it; *Export current game* exports the game being played
* The main menu's backdrop tours its town in a slow figure eight (it used to pan away until the town was out of sight)
* Saves are version 7 (storage orders, rubble records, the five gods); version 6, 5 and 4 saves load
* Measured against v0.11.1 (`npm run sim`, 3 years): Normal 525 to 669 people, fires 9 to 1, margin 587 to 5,199 Dn (its mood falls 45 to 40 and peace 53 to 33: the bigger town meets the job shortage below); Hard fires 11 to 5; Insane margin -4,586 to -3,141. Sweep, missions 3, 4 and 6 over 5 years: fires down on every difficulty but mission 6 Hard (11 to 20); Insane's mission 3 need 8,402 to 5,291 Dn; mission 4 peace on Normal 36 to 80. The campaign's pace changes only for missions 1 and 2
* 309 unit tests (+81), 98 browser checks (+18)

## Done (v0.11.1)

* **Money for every difficulty, measured** (the aim: a sensibly run city of modest homes pays its way; the lever is taxes). Each resident now pays 5 Dn a year per point of their home's tax weight, not 2: before, only a city of Apartment Houses paid its wages, so every smaller one lost money on every difficulty, and the starting funds only said how soon it went broke (a sensible city on Normal was in debt by its third year in mission 3; on Insane by month 8). A Cottage town now about pays its way and better homes make a profit; the starting funds are unchanged
* **`npm run sweep`**, the balance table: every difficulty on every campaign map, with a level 3 demo city (piped water, so its homes climb like a player's) that rebuilds what burns or collapses; it reports the money the city needed against what the difficulty gives, beside population, mood, peace, fires, thieves and outbreaks, read against each difficulty's intent (Easy never short, Normal comfortable, Hard tight, Insane barely enough). `npm run sim` now reports that money too (its city starts rich, so it never showed)
* Measured with the sweep, missions 4, 6 and 7 (margin as a share of the starting funds): Easy about +75%, Normal +50%, Hard +3% to +27%, Insane about -50% for the demo city (it keeps a fixed layout and rebuilt 50 to 156 burned buildings in 5 years; a sharp player covers fires better). Replaying the lost mission 3 Insane game with the same moves: it now stays solvent (at worst -112 Dn after thieves took 1,135) instead of 1,276 Dn in debt, so money is no longer what decides Insane; mood (about 30 after the new-city bonus ends) is. The early missions stay harder for the demo city, partly because it builds what they do not unlock
* 228 unit tests (+2), 80 browser checks

## Done (v0.11.0)

Fixes from playing mission 3 on Insane (the game said things that were not so, or said nothing):

* **Homes with food** (Overview) counts the homes whose people eat (tents forage, and are left out) that hold food. It used to count homes not going hungry, and tents never go hungry, so a city of tents with no food anywhere read 100%. The mood's food factor is unchanged
* **Wells and reservoirs out of every engineer's reach**: they need no road, but they wear out, and an engineer repairs only what lies within 2 tiles of the road he walks. Placing one further off now warns, and its panel and the Problems overlay flag it (a reservoir collapsing unseen dries every fountain and bath it feeds)
* **A home's tax line says why it pays nothing**: no Forum, a Forum without workers or a road, or no tax collector in the last 48 days (with what to do about it); a registered home shows how many days its registration has left. It used to say "needs a Forum nearby" with a Forum next door. The Finance tab counts the homes that are not registered
* The balance sim is byte-identical on every difficulty after these three
* **Loans from Rome** (Finance advisor): a city in debt could never build again, so one that lost its Forum while in the red could never recover. Rome now lends 2,000 Dn whenever no loan is being repaid, repaid monthly over 24 months with interest by difficulty (10% Easy to 40% Insane, a new lever in the difficulty table); the debt message points to it. Borrowed money is not counted as profit. A city that never borrows plays exactly as before
* **Roamers prefer streets with something to serve**: at a junction a roaming walker looks up to 8 tiles down each way (stopping at a roadblock that would stop it) and favors the ways lined with buildings or reaching one, so short spurs to an outlying building keep their visits. A lone Forum's tax collector (and the engineers) used to spend whole rounds on the Imperial road out to the empty map edge. Replaying the mission 3 game with the same moves, the three key buildings that collapsed in August now stand. Over 12 maps: fires down on every difficulty (Hard 11 to 7.8 in 3 years), protests down, the campaign's pace unchanged

* **Disease** (parity item 4): every home has a health score (its level, a medicus, a hospital within reach, baths, a barber, fountain water, each kind of food; at most 40 with no food at all). Crowded, unhealthy homes build disease risk like fire risk, and a passing physician clears it; at 100 a home may fall sick: a fifth of its people die (a tenth near a hospital), and for 32 days it cannot move up or take in settlers and may pass it to the homes touching it (once a day each). A staffed Medicus sends a physician to cure it, as prefectures send prefects to fires. City health (the residents' average score) moves 2 a month, shown only. None below 200 people or in the first two missions; a new difficulty lever (x0.5 Easy, x1.3 Hard, x1.5 Insane). A Disease overlay (disease risk, sick homes marked), a *Health* section in the house panel, a pale cloth on a sick home's door post, sick homes and homes in unrest first on the Problems overlay, citizens who talk about it, console `health` and `sick`, and the sim report's outbreaks and deaths
* Saves are version 6; version 5 and 4 saves load with nobody sick
* Measured, 12 maps x 3 years against v0.10.1: population up on Easy, Normal and Hard (Hard 425 to 456), fires down on every difficulty (Normal 4.8 to 3.0), outbreaks per city 0.1 (Easy), 0.8, 1.0 and 4.6 (Insane); Insane's neglected demo city also meets more thieves (4.8 to 12.4) and a little less peace (31 to 28); the campaign's pace unchanged
* 226 unit tests (+34), 80 browser checks (+1)

## Done (v0.10.1)

* **Crime costs peace by difficulty**: none on Easy; on Normal a riot costs 5 and a thief 1 and that month's gain; Hard doubles it (10 and 2), Insane triples it (15 and 3). Protests stay free, except on Insane, where every fifth costs 1: even a well-run Insane city sees about 17 a year, so a cost for each would sink peace faster than it can grow. Measured over 12 maps: Easy, Normal and Hard play exactly as v0.10.0; Insane ends 3 years with peace 31 instead of 45, and a neglected Insane city loses it all
* 194 unit tests (+2), 79 browser checks

## Done (v0.10.0)

* **Crime** (parity item 3): every household has a mood of its own (the city's mood plus hunger, food variety, envy of the rich, its street's desirability, and whether the tax collector has found it), used for crime only; settlers still follow the city's mood. Once the city has 300 people, each day the unhappiest home that still can may send out a **protester** (harmless), a **thief** (walks to the Forum or Senate and steals a quarter of the year's taxes, at most 400 Dn and never more than the treasury holds; with no Forum in reach, half a market's biggest stock) or, in a very unhappy city, a **riot** (the rioters burn their own home and march on the most prized building nearby, setting fire to what they pass; afterwards every home's mood rises by 20). The chance follows the city's mood, times a new difficulty lever (x0.5 on Easy, x1.2 Hard, x1.4 Insane), and none in the first two campaign missions
* **Prefects as police**: a prefect passing a home halves its chance of trouble for 32 days (a change from the original, where patrols did not prevent crime); prefects and soldiers catch the criminals they meet, and prefects on patrol chase thieves and rioters within 30 tiles. A prefect who catches a thief on the way saves the money
* **Peace**: a month with a thief about brings no peace gain, a riot costs 5 at once; protests cost nothing
* **Crime overlay** (a column over every unhappy home by its mood, taller for a home that already sent a criminal; point at one for its mood, its worst trouble and whether a prefect patrols it), a *Mood and order* section in the house panel, *Stolen by thieves* in the Finance ledger, citizens who talk about it, and protester, thief and rioter walkers of their own
* Console: `crime`, `crime protest|thief|riot`, `riot`, `unrest <n>`; `npm run sim` reports protesters, thieves, thefts, riots and what rioters burned
* The balance sim's demo city now builds every service it plans (on its default seed it had silently lost its Forum and second market, so it never collected tax); the balance baseline moved with it (see the commit)
* Saves are version 5; version 4 saves load with fresh moods and no crime yet
* 192 unit tests (+32), 79 browser checks (+1)

## Done (v0.9.1)

* **The Problems overlay** (top bar): a column over every home that cannot move up, colored by the first thing it lacks (water, food, temples, entertainment, education, health, goods, desirability, room to grow) and taller when it is already falling back (none where the next level needs something the mission cannot give, such as fountains in the first mission); red over empty lots no settler can reach and over buildings that do not work, amber over those that work badly. Point at a column for the reason in words; a legend lists the colors (not on phones, where a tap on the building says it)
* **The Production advisor**: per good, what was made, used, imported and exported last month and what the storehouses hold, with the month's change; the buildings that are not working, grouped by reason, each group with a *Show* button that goes to the next one; and the bottlenecks in plain words (workshops waiting for a raw material, with what makes it and who sells it; buildings without workers; harvests with nowhere to go; goods used faster than they come in; homes short of food)
* **Trend charts** on the Overview tab: population, treasury and mood, month by month, up to 20 years
* A goods book in the simulation counts it all (bookkeeping only: the city plays exactly as before)
* 160 unit tests (+5), 78 browser checks (+3)

## Done (v0.9.0)

* **Roadblocks** (Roads menu, 12 Dn): placed on a road, they turn back walkers who roam the streets serving homes, so a temple, market or school serves the blocks you mean it to. Click one to let groups through: prefects and engineers, priests, market vendors, entertainers, teachers and librarians, barbers and physicians, tax collectors (none at first). Carts, market buyers, settlers, caravans, prefects running to a fire and roamers on their way home always pass, and soldiers and raiders never notice one. Clearing a roadblock leaves its road; roadblocks are saved (older saves load without any)
* **Click a walker** to see who it is, where it comes from, what it is doing and carrying, and what it has to say: citizens talk about what troubles the city most (raiders, hunger, fires, no work, taxes, low pay, debt, an angry god, a gloomy mood) or about their own work, newcomers about their hopes, emigrants about why they leave, traders about trade. All the lines are Colonia's own. *Follow* keeps the walker in view until you move the map; a ring marks it
* In-game help: roadblocks and walkers; the raid rule now says 300 people (it still said 120, from before v0.7.5)
* 155 unit tests (+7), 75 browser checks (+6)

## Done (v0.8.2)

* **A longer campaign**: the seven missions' goals follow the 20-level ladder and set their length. Mission 1 asks for 1,200 people, culture 15 and peace 35 (was 250 people alone, won in about 5 months); mission 7 for 12,000 people, culture 75, prosperity 70, peace 75 and favor 65 (was 6,000, 60, 55, 40, 55). Each mission's culture and prosperity goals ask for a good share of what its buildings can give, and the homes they allow climb through the campaign: Huts, Townhouses, Domus, Villas, then every level
* **Bigger maps** for missions 2 to 7: 96, 112, 128, 128, 128 and 160 tiles a side (were 80, 96, 96, 112, 96 and 128), each with farmland for half as many again as its goal
* **Planned pace**: the fewest game years the goals allow, from the game's own rates (settlers a month at a good mood, peace a point a month, culture and prosperity a few points a month): 1.3, 2.2, 3.6, 5.7, 7.8, 8.5 and 15.4 years (were 0.2 to 7). With the city to build first, that is roughly half an hour for the first missions and a few hours for the last at normal speed. `npm run sim -- --pace` prints the table; a test holds each mission to its plan
* The first mission has a Forum: a longer first mission needs taxes (the demo town went broke in about two and a half years without one)
* Mission hints use the new level names and say what the goals need (peace needs a mood of 45 or more; the top homes need wine from two sources)
* Missions already under way keep their map and take the new goals
* 148 unit tests (+4)

## Done (v0.8.1)

* **Every god's temple looks like its god**, on the map and in the build menu: roof and wall colors, the god's color and emblem on the pediment, and something of the god's in front (Jupiter: a gilded roof, a thunderbolt and an eagle on a column; Ceres: an ochre roof, a wheat sheaf and baskets of the harvest; Neptune: a verdigris roof, a trident and a pool with a dolphin; Mars: a dark red roof, a shield and a trophy of arms; Vesta: a round temple with a bronze dome and the sacred hearth, as the real one in the Forum). Mercury's and Venus's temples are drawn already, for the switch to the original's five gods (since made: item 14, where Jupiter's and Vesta's temples gave way to theirs)
* **New statues**: a marble orator on a moulded pedestal, a bronze warrior with spear and cloak on a stepped plinth among cypresses and flower beds, and a bronze horseman on a tall inscribed pedestal in a paved square
* **A new iron mine**: a rocky hillside with a timber-framed entrance, a winding frame, rails, an ore cart and a heap of red ore
* **Aqueducts**: the channel steps down to a reservoir's rim and pours in (it used to butt into the reservoir's wall above its rim); a straight aqueduct crossing a road is a bridge, a pier each side and one wide arch with the road beneath
* `render.html?artset=1` sets out these pieces beside the demo city; the art sheet shows every temple, statue and mine (`extras=1`)
* 144 unit tests (+3)

## Done (v0.8.0)

* **A library of music tracks**: ten named tracks of 3 to 5 minutes for the menu, the day and the night (*Colonia*, *Prima Lux*, *Mane in Foro*, *Via Nova*, *Aquae Vivae*, *Messis*, *Lares*, *Vesper*, *Nox Serena*, *Stellae*), picked at random and never one of the last three. Pieces used to be about 20 bars, under a minute, each a new random one. Each track is written from a fixed seed with its own key, tempo, meter, pipes and tune, so it sounds the same every time, and has its own way in: the lyre alone, a drone and a pipe call, the drums building up, the pipe alone, a slow swell, or the whole band
* Longer forms for all music: an opening, rounds of sections until the piece is long enough (the theme, a higher answer, a calmer contrast on the other pipe with a thinner accompaniment, a passage for the lyre alone), and an ending. Festival and battle music keep pieces of their own, new each time, now about 3 minutes (were under one)
* No more cut-off tracks: raiders and festivals still take over at once, but between calm moods a track that plays in the new mood carries on, and one that does not finishes its phrase and plays its ending
* Console `music tracks` and `music play <track>`; the music lab plays each track
* 141 unit tests (+5), 69 browser checks (+1)

## Done (v0.7.5)

* **Raids come later**: the first raid waits 5 years with occasional raids (was 2.5) and 3 with frequent ones (was 1.5); campaign missions 4 to 7 wait 5, 4, 3.5 and 3 years (were 3, 2.3, 2 and 1.7); Insane still 25% sooner. No raid while the city has fewer than 300 people (was 120). There was no time to build a town and an army (an iron mine, a weaponsmith, a barracks and a fort) before the first warband: on Normal it arrived in the sandbox's third year
* Measured (demo city without an army, 4 landscapes x 3 seeds x 4 difficulties, 8 years, occasional raids): raids per city on Normal 1.5 (was 2.1), buildings lost 11 (was 16), population after 8 years +22%; on Insane cities no longer collapse (238 people after 8 years, was 85)
* 136 unit tests (+1)

## Done (v0.7.4)

* **A timber yard needs woods**: at least 4 tiles of forest within 2 tiles, to be placed (the preview turns red and says so) and to keep working. A single lone tree used to count as forest, so a third of the spots it accepted were out in open country, and such a yard ran at full speed
* 135 unit tests (+1)

## Done (v0.7.3)

* **Fires spread more slowly**: a building beside a fire is heated (+5 fire risk, was +10) and gets its chance to catch (2%, was 3%) once a day, however many burning tiles it touches; before, it rolled once per burning tile, so a big burning building rolled against its neighbors several times a day. One fire in an unguarded 48-tile block of tents now burns about 10 tiles in 40 days (median 8, worst of 40 runs 31), where it burned the whole block (46); with a prefecture beside the block, 1.4 (was 1.8). How often fires start is unchanged: in the demo-city sweep (prefects on patrol) fire counts stay about the same, population within 3%
* 134 unit tests (+2)

## Done (v0.7.2)

* The Imperial road runs straight in from the map edge for 3 tiles at both ends, so the entrance and exit gateways always face the map edge with the road passing straight through (on about a quarter of maps a road end ran along the edge and turned its gateway sideways, toward the middle of the map)
* No single-tile water: water patches smaller than a 2x2 pond become land (lakes, plains and desert maps had a few specks each)
* Settings: each checkbox stays beside its label (a long help text used to push it onto a line of its own, where it looked unlabeled above the next setting)
* Maps for a given seed changed where a speck or a road end moved; saves keep their own map
* 132 unit tests (+2), 68 browser checks (+1)

## Done (v0.7.1)

* **Water where you build**: with the Housing tool in hand, a faint blue shows where homes would get water, as the original did (paler for well water, stronger for fountain water); placing a fountain or baths shows the reservoirs' piped area in the same faint blue, so you can see where it will run. Each area gets a thin outline, and the placement preview of a well, fountain or reservoir still draws on top
* In-game help: well water turns tents into Family Tents (it still said lean-tos, from before the 20-level ladder)
* 130 unit tests (+1), 67 browser checks (+2)

## Done (v0.7.0)

* **The 20-level housing ladder** of the original game, rebuilt with Colonia's own names and numbers: single-tile homes up to level 10 (four alike, side by side, can join into a 2x2 block), 2x2 insulae and villas, 3x3 villas and palaces, 4x4 palaces. New art for the new levels (Family Tent, Stone Cottage, Merchant House, Apartment House, the 2x2 villas and the 4x4 palaces); the art sheet shows every level and the blocks, and `render.html?ladder=1` sets out one home of every level beside the city
* **The original's rules for moving up and down**: a home moves up as soon as it qualifies (one level a day) and falls back after 3 bad days in a row, a bad day being a missing need or desirability at its level's floor (each level now has its own floor and ceiling); Easy allows 6 bad days (a new difficulty lever). Growing homes take over homes of their own level or lower, then clear land, then gardens, and break up homes they only partly cover; big homes split when they fall back (keeping a corner that still has a road in reach); residents over capacity look for another home, as when an Insula becomes a Villa
* **The original's needs**: education and medical care as tiers, barber and baths as needs of their own, two wine sources for the top levels (a staffed winery, and each open route selling wine while wine is set to import), and entertainment as a city-wide base (venue seats against the population) plus the venues whose entertainers passed by, worth more while a venue runs both kinds of show. Tents forage; homes eat and stock only the kinds of food their level needs; goods are used twice a month; a service visit lasts 96 days; emigrants leave the humblest homes first, never villas or palaces
* **Where the original has a plain bug, Colonia does not copy it**: a 3x3 home broken up by a growing palace keeps all nine tiles (and its people and goods); homes that split share people and goods by the tiles each part covers; market food deliveries top a home up instead of piling a full portion on top; an unstaffed winery is not a wine source
* Mood and prosperity rescaled to the longer ladder (full marks for housing at an average of Apartment Houses and Insulae); culture needs an average entertainment of 40 for full marks (was 35), since every home now gets the city-wide base
* Saves from before v0.7 cannot be loaded, and say so (until 1.0 a release may break older saves)
* Measured (`npm run sim`, demo city, 4 landscapes x 3 seeds x 4 difficulties, 5 years, no raids): population about the same as v0.6.2 (Easy +4%, Normal +5%, Hard flat, Insane +11%), everyone fed where some cities starved (tents forage), a fifth fewer homes moving up and down on Easy and Normal (fewer on Hard and Insane too), prosperity about 3 points lower and culture 1 to 8 higher (a service visit now lasts 96 days, so more homes count as covered); the demo city (wells only, no shows) never gets past level 4 in either version, so the upper ladder was checked with desirability probes of decorated blocks instead. With Colonia's building values a well-decorated block reaches the 2x2 levels with gardens, temples and statues, and the palaces with plazas or large statues
* 129 unit tests (+26), 65 browser checks (+2)

## Done (v0.6.2)

* The `--garrison` balance simulation no longer collapses: the demo garrison had put military labor first (a v0.5.1 test fix), which left prefects, engineers and farms short of hands; on Hard and Insane most demo cities burned down or starved to 0. Over 12 maps, Insane now ends near 370 people with about 12 soldiers (was 7 people and 1 soldier). The console `garrison` showcase still puts military labor first, and now says so
* A building no longer loses its workers and walkers to a stray piece of road laid against it: buildings (and homes, within their 2 tiles) prefer a road that reaches the map entrance over one that does not, as the rules always said. This also removed the last random failure of the smoke test's garrison step (0 of 300 seeds, was 1)
* 103 unit tests (+2)

## Done (v0.6.1)

Fixes from a review of v0.6:
* Title screen: a quick Enter or key press now leaves the keyboard on the menu (it was lost until Tab); where autoplay starts a moment late (Firefox, Safari) the title card no longer flashes up and fades out
* Top bar: the season's name only shows while the bar has room (it clipped the Help and Messages buttons at about 1281-1450 px wide)
* Snow and season changes that arrive a few frames apart no longer mix two looks on screen or draw hundreds of sprites in one frame (the complete old look stays until the new one is ready)
* Map gates face the Imperial road as it was laid (saved with the map), so a road built beside the entrance or exit no longer turns the gate across the road
* Horse Ranch "Next mare" counts the Insane winter rest
* Docs: the months that blend season looks, the test list in the README
* 101 unit tests (+3), 63 browser checks (+3)

## Done (v0.6)

* **Menu music**: the music starts on the title screen, at once where the browser allows autoplay, otherwise with the first click, tap or key on a "Click, tap or press a key to begin" gate (which never presses a menu button); on phones one tap is enough (it took two)
* **Four seasons with their own weather**: Winter (December to Februarius), Spring, Summer and Fall, shown in the top bar; spring is the rainy season (nearly three times summer's rain), summer mostly clear with the odd thunderstorm, fall showery, and winter only snows (no winter rain or thunder, no snow outside winter); a new season brings new weather at once; a new or loaded game opens clear
* **Winter looks like winter**: December to Februarius are full winter scenery, and snow settles on the ground, trees, rocks, roofs and fields, then melts in spring; the new look is prepared in the background and swapped in whole (this also removed the old one-frame hitch at every month change); `snow 0-3` console command
* **Insane: nothing grows on the farms in winter** (crops, pigs and the Horse Ranch rest from December to Februarius, keeping their progress); warnings in October, December and at the start, winter-toned resting fields, info-panel status; Easy, Normal and Hard play out exactly as before
* **Map entrance and exit gateways**: stone pillars and a lintel over the Imperial road where it meets the map edge, green pennants where people arrive, red where they leave, torches at night
* A fresh map no longer scrolls off to the side by itself (a menu vanishing under a still cursor looked like a cursor at the screen edge)
* 98 unit tests (+17), 60 browser checks (+16)

## Done (v0.5.2)

* No rock or meadow within 6 tiles of the Imperial road (the first building lots are always usable; rock beyond stays for quarries and mines)
* Farm plots come as whole fields: broader meadow noise, smoothing, no field under 12 tiles, meadow share measured over land (coasts and desert oases were nearly barren); more full-fertility farm room on almost every landscape
* Easy: fire and collapse risk x0.5 (was x0.7); most young cities never see a fire
* Demo city and garrison builders only use roads that reach the map entry (fixes a random smoke-test failure)

## Done (v0.5.1)

* People walk instead of jog: the game clock runs at 12 ticks a second (a game day takes 1.67 s at 1x, balance unchanged), speeds are 1x/2x/4x/8x, and legs step with the distance walked; long-trip settlers ride their mules at a trot (2x)
* No rock within about 5 tiles of the Imperial road
* Rain and snow no longer fall at the same time

## Done (v0.5)

* **Uber maps**: 256x256 sandboxes (sixteen times Small); settlers with a long way to go ride in on mules
* **Insane difficulty**: every difficulty lever in one table (`src/data/difficulty.js`); Insane scales money, fire risk, production, immigration, city mood, raid size, timing and raider strength, and the Emperor's demands; difficulty choice in campaign briefings, remembered between games, with a "beaten on" badge per mission; `difficulty=` URL flag and `--difficulty` in the simulator
* **Smaller saves** (format v3): map layers run-length coded, paths packed to 16 bits; an Uber save dropped from about 780 KB to 300 KB; older saves still load
* 16 new unit tests (save packing, old saves, Uber, difficulty levers), 4 new smoke checks (79 unit tests, 44 browser checks)

## Done (v0.4)

* **Music**: generative soundtrack composed live in modal scales, played by synthesized lyre (Karplus-Strong), reed pipe, pan flute, frame drums, horn and sistrum through a generated reverb; moods for the menu, day, night, festivals and raids with crossfades; music switch and volume in Settings, M key, console controls and WAV export
* Music lab page (`tests/e2e/music.html`), 9 composer tests, 4 new smoke checks (63 unit tests, 40 browser checks)

## Done (v0.3)

* **Day and night**: sky tint by time of day, lit windows (positions recorded from the art), torches, lanterns on walkers, glowing fires; a setting
* **Seasons**: monthly ground and tree palettes (spring blossoms, autumn leaves, bare winter trees); a setting
* **Weather**: clear, cloudy, rain, thunderstorms with thunder, winter snow; a setting; reduced-motion safe
* **Animation**: fluttering flags and banners, shoppers at stocked markets, crowds during shows, forge sparks, altar fires
* **Smooth camera**: eased zoom toward the cursor, drag fling, glides to messages and landmarks, trackpad-friendly wheel
* **Terrain**: 8 ground variants with small details, soft blended edges between grass, meadow, forest floor, sand and rock
* **Art detail**: wall texture and contact shadows, tiled roofs with ridges and eave shadows, 8 looks per home (shutters, flower boxes, chimneys, jars, fences, washing lines)
* Art sheet page for reviewing every home look (`tests/e2e/artsheet.html`); 54 headless tests, 36-check browser smoke test

## Done (v0.2)

* **Military**: barracks, legion/archer/cavalry forts, watchtowers, walls and gates; raids with warnings, scaling warbands, siege, retreat and plunder; deploy/recall orders; Military advisor and raid alert
* **Supply chains for troops**: weapons (legionaries), Fletcher arrows from timber + iron (archers), Horse Ranch with a growing breeding herd (cavalry)
* **Sea trade**: navigable water detection, Docks, merchant ships, land/sea routes, 9 partners, empire map in the Trade advisor
* Autosave when the page is hidden or closed; save sizes and storage usage in the menus
* Open source: MIT license, contributing guide, code of conduct, security policy, issue/PR templates, CI with a reproducible-build check
* Tests: 37 headless tests (core, military, trade), 32-check browser smoke test
* Graphics: building shadows, construction rise-in, swaying forests, water glints, fountain spray, fire glow and embers, hearth smoke, cloud shadows and birds (with a setting and reduced-motion support); water supply radius on click and while placing

## Done (v0.1)

* Procedural maps: river, coast, lakes, plains, desert; seeds; 3 sizes
* Roads, plazas, bridges, aqueducts, clearing, undo
* 12 housing levels with merging into 2x2 and 3x3 homes
* Walker-based services: prefects, engineers, priests, teachers, librarians, scholars, barbers, physicians, bath attendants, entertainers, tax collectors, market vendors and buyers
* Water network: wells, reservoirs, aqueducts, fountains, piped area
* Food chain: 6 farm types, granaries, markets
* Industry: 4 raw materials + marble, 5 workshops, warehouses feeding workshops
* Entertainment with performer supply (theater, amphitheater, colosseum)
* Fire and collapse, spreading fires, prefects responding to fires
* Labor with priorities; immigration/emigration driven by city mood
* Taxes, wages, tribute, ledger; overland trade with 6 partner cities
* Five gods with moods, festivals, blessings and wrath
* Ratings (culture, prosperity, peace, favor), Emperor's requests and gifts
* 7-mission campaign + sandbox; victory and defeat
* Advisors, overlays (water, fire, collapse, desirability, services, employment), minimap
* Save slots, autosave, file export/import, crash screen with report
* Touch controls and phone layout; synthesized sound effects
* Tests: 16 headless sim tests, 18-check browser smoke test, balance simulator

## Caesar III parity: what the original had that Colonia does not (yet)

Open items only; each keeps its number (#n) for good, so the release notes and the Done lists still point at it. Done so far: #3 crime (v0.10.0), #4 disease (v0.11.0), #11 walker click-to-inspect (v0.9.0), #10 granary and warehouse orders, #12 the empire map and #14 the original's five gods (v0.12.0), #2 fishing wharves and shipyards, #5 the hippodrome and #15 the Health, Education and Entertainment advisors (v0.13.0), #1 the Emperor's legions and distant battles, #6 the governor's residence, salary and rank, #16 triumphal arches, #17 the Military Academy (with Colonia's own Portus) and #18 large temples (v0.14.0), #24 staged raid warnings and the legions' reminders (v0.15.7), #13 campaign branches, a peaceful and a military province at every step from 3 to 10 (v0.15.0 and v0.17.0), #7 map rotation, the city seen from four sides (v0.18), #9 events (Rome's wage, trade disruptions, bad water, mine collapses and floods, earthquakes, price changes, a new emperor and the gladiator revolt), #19 wolves, #21 enemy armies by region, each province raided by its own people, #25 two kinds of bridge, a ship bridge every boat passes under and a low bridge none passes, #22 the Hall of Fame, a score for every campaign win and the career, and #20 native villages and the mission post, in Mutina, Luna and the sandbox (v0.18.1).

* **#8** **Scenario/map editor**, which doubles as modding (missions saved as data files).
* **#23** **City sounds**: the original played each building's sounds near the camera. Ours would be synthesized (market chatter, forge clanks, gulls at the docks) and change as you zoom.

## Modernization: from the community engines

What Augustus (4.0) added to the original, checked against its manual and release notes, adapted to Colonia:

* **Roadblock permissions on gates, bridges, granaries and warehouses** (roadblocks themselves came in v0.9.0): only roaming service walkers are stopped. Anything with a destination (carts, caravans, settlers, market buyers) passes, so service coverage becomes a puzzle instead of a dice roll. Each roadblock carries a permission per group of walkers: maintenance (engineers and prefects), priests, the market vendor, entertainers, education, medicine, tax collectors, labor seekers, missionaries and watchmen, plus everyone else. Gates, bridges, granaries and warehouses can carry the same permissions. Roadblocks default to denying everyone.
* **Market special orders**: each market switches every good on or off (all on by default). The buyer only fetches goods that are on, and the vendor only hands out goods that are on and that the house's next level uses.
* **Partial warehouse storage** (Accept, Refuse and Get per good came in v0.12.0): a limit per good counted in loads (accept up to it, get up to it), and later versions' "maintain a reserve".
* **Supply posts**: fort soldiers eat. One post per map; its quartermaster fetches food from granaries, and shortages cut morale (an option; the original's rule is the default).
* **Global labour pool**: an option that removes the need for labor-seeking walkers to pass homes; every building with road access is fully staffed while enough citizens are unemployed, and category priorities still apply. The original's rule is the default.
* **Extended campaign**: after victory, the player can accept the promotion again or extend the regency, indefinitely.
* **Also in Augustus 4.0, candidates for later**: the **Cart Depot** (ox carts move goods between storage buildings on orders: source, destination, good, condition), the **Tavern** (wine, meat and fish give entertainment), the **Watchtower** (a cheaper tower that needs no weapons but needs a barracks), the **Highway** (a fast road that only destination walkers can use, with a cost per tile), and new materials (stone, sand, bricks, concrete, gold) with a **City Mint**.
* Already in Colonia: zoom, much bigger maps (Uber), a console, roadblocks, and per-good Accept, Refuse and Get orders with an Empty switch for granaries and warehouses.

## Modernization: Colonia's own

Seeing why:

* **Charts per good over time** (the Production advisor and the trend charts came in v0.9.1).
* **Production calculator**: turns a target into building counts (feeding 1,000 people takes about 3 full wheat farms).
* **Walker traffic heat map**: where walkers actually go, which shows where roadblocks belong.
* **Year in review** and a **city chronicle**: a yearly report card with charts, and an auto-written history of the city ("297 BC: the great fire of the east quarter took 14 homes").

* **Province mode** (Colonia's own, after SimCity 4's regions; a third way to play beside the campaign and the sandbox; on the main menu as "coming soon" since v0.19.2): a province split into city sites (on the empire map, or a grid), each an ordinary Colonia city the player founds and plays (a port, a mining town in the hills, a farming town on the plains). The player's own cities trade with each other as partners, through the existing routes, caravans, ships, prices and per-partner switches, their quotas taken from each city's real stock and surplus. As in SimCity 4, only the city being played runs: the others wait where they were left, and trade between them is settled when the player switches city, so nothing runs in the background and the sim stays deterministic. Shared: events, raids and Caesar's favor (to decide: one treasury, or each its own with transfers; an army sent to a neighbour's aid). Goals optional (none, or "a province of 50,000"). Needs: saves in IndexedDB with compression (several cities outgrow the browser's 5 MB; Nova Roma needs it too), the province screen (found, pick and switch cities), own cities as trade partners in the trade code, and the province-wide rules.
* **Mission 11: Nova Roma** (Colonia's own, the campaign's finale; Constantine's refounding of Byzantium as Nova Roma is the model). After step 10 the player claims the purple; to make the claim stick they build a new Rome, and old Rome (the Senate and the great families, who want their power back) fights it. On an Uber map (256 tiles), the only mission there.
  * **The palace**, silly big and silly expensive: a footprint marked out whole as a construction site (a ghost of the finished palace, about 20x20 tiles, twenty-five times a Grand Palatium, with gardens and an artificial lake after Nero's Domus Aurea), built in stages over years (foundations, walls, colonnades, the golden hall, gardens and lake, a colossus of the new Caesar). Each stage wants absurd amounts of goods (thousands of marble, timber, bricks, furniture, wine, oil) and money. Finished, it employs a silly number of people (hundreds of servants, guards, gardeners and clerks), so it is also where a good part of the 20,000 citizens work. And it must be kept: finished, it consumes every good the city makes, in silly amounts and all the time (each food, wine, oil, furniture, pottery, clothing and the rest, delivered from storage like a palace-sized home), and a shortage dims it (its desirability, the governor's standing, the city's mood) until the supply comes back.
  * **The work camp**: a staging area by the site that oversees the building; its workers cart the goods in from storage and its builders (an architects' guild, as in Augustus's monuments) advance each stage. The camp must be fed and watered (food carted from the granaries, a well or fountain in reach): without them the work slows, then stops. The monuments of v0.19.0 already use the same machinery (stage tables, the Castra Operarum, upkeep), with the footprint size a parameter.
  * **Old Rome's answer**: from the moment the site is marked out, elite troops (Praetorian cohorts, stronger than any raider) march on it; each finished stage makes the next waves bigger and sooner, the last stages a siege. They make for the site: damage sets a stage back, so it must be walled and garrisoned.
  * **Gold** (for the Golden Hall's gilding; the game has none yet): to decide. Suggested: a rare gold mine on a few of the map's rock outcrops with a goldbeaters' workshop (bratteari) making gold leaf, topped up by gold imported from Hispania at a steep price (the Romans' gold came mostly from Hispania's mines, Las Medulas above all, and later Dacia's).
  * **To win**: the palace finished, at least 20,000 citizens, high ratings, and the city still standing. A Hall of Fame score of its own.
  * **Before it can be built**: footprints past 5x5 (the monuments' machinery, v0.19.0, takes the size as a parameter); the economy's jobs for 20,000 (the largest province today employs about 13,500: Puteoli), and settlers fast enough that 20,000 does not take decades; speed on an Uber map with thousands of walkers (the sim in a Web Worker, terrain chunk caching, below); saves that fit the browser's storage for a city that size (smaller saves, below).
* **Strike the raiders' base** (Colonia's own; the Romans' punitive campaigns against the Ligurians and Gauls are the model): once a raiding people has been scouted or beaten off a time or two, its camp appears on the empire map, and forts with Empire service can be sent against it like a distant battle. Months on the march there and back leave the city short of defenders. It needs a large army (the camp grows with every raid it has sent: something like two to three times its last warband), trained men counting more; liburnians could strike a sea raiders' base. A win stops that people's raids for a few years, lifts peace and brings some plunder; a defeat loses the men and brings the next raid sooner and bigger. Details to settle before building.
* **Friendly villages** (Colonia's own, after a playtest of the plain rules from parity #20): a village calmed for a year without a break becomes a friend; its trader then also sells (a good its land gives: timber, hides as meat, marble near Luna), and in a military mission its people's raids are smaller or put off while the friendship lasts. A raid by the same people that destroys a friend's work breaks it.
* **The late missions need more jobs**, what is left of it (the jobs groundwork came in v0.16.5, the late provinces in v0.17.0, every goal fitted to its jobs): after a playtest of the late steps, whether the military missions of steps 4 to 7 ask for more people again (Pons Aelius, Portus Mercatorum, Oasis Aurea and Urbs Magna ask for 63 to 77% of their ceilings of 3,510 to 8,160, where the peaceful provinces from step 3 ask for 83 to 90%; Portus Mercatorum's 3,900 is held down by Oasis Aurea's pace, so more people there means a longer Oasis Aurea too), whether big cities need more settlers (a 10,000 goal takes 12.6 years at the fastest, 12,000 take 15.4), whether raids should grow past their cap of 40 raiders for the largest provinces, and, only if play shows idle hands the capacity model does not, slower workshops (the original's pace).

From playtesting (still to decide which to take):

* **The early missions on Hard and Insane**: the sweep's demo city finds them harsh, partly because it builds what those missions do not unlock (`npm run sim -- --unlocks` builds only what they allow); measure again with it before changing anything.
* **Festival costs** (after v0.18.4): Colonia's small festival costs about 3.5 times the original's money (60 + 0.15 a citizen against the original's population / 20 + 10), and keeping five gods content now takes about five festivals a year; the food's one-load minimum is steep for a town just past 800 people. Whether to lower either.

Playing smoother:

* **Blueprints**: copy and paste housing blocks, and a ghost planner that builds each piece once you can afford it.
* **Pinned stats**: pin any good or rating to the top bar.
* **Per-building labor priority**, on top of the category priorities.
* **Custom difficulty**: sliders over the lever table (every lever already lives in one table).
* **Interactive tutorial mission**.
* **Photo mode**: hide the UI, pick the time of day, season and weather, save a screenshot.
* **Accessibility**: UI scale and a screen-reader pass (reduced motion is already honored).
* **Challenge games**: one-off scenarios outside the campaign, picked from a Challenges menu, each a fixed map with its own rules, goal and time limit, and a best result kept per difficulty. Ideas: hold a frontier town through ten raids; feed a desert city on imports alone; rebuild a burned city from its rubble; the Emperor's legions already marching when the game starts; a famine winter on Insane; grow to 2,000 people with no prefecture; a Venus festival city judged on mood alone; a million denarii to start but no trade and no Forum (no taxes: the fortune must last); a map with almost no farmland, where the city lives on food bought from its partners; Hordes, endless raids that start as a handful of raiders and grow with every wave, the city's score how many waves it outlasts. Each one names what it leaves out or adds, and its numbers are measured with the headless sim like a mission's.
* **Challenge seeds and ironman**: a fixed map plus rules, with medals and par times; autosave-only games.
* **Share-a-map link**: seed, landscape, size and difficulty in one link (the URL flags already exist).

Platform:

* **Sim in a Web Worker**: keeps big maps smooth at 8x, still deterministic.
* **Installable offline app** for the standalone build.
* **Downloads in the claude.ai viewer**: route save export through the viewer's downloads capability, so Export works there too.
* **Scripting console**: a sandboxed build API for automating your own layouts.

Security:

* **Save import hardening**: treat imported saves as untrusted input (size caps, map-size bounds, rejecting `__proto__` keys, a fuzzed loader). Today the loader checks the structure and the version.
* **Content Security Policy** for the single-file build.

## Built on the deterministic sim

The sim is deterministic (seeded RNG, never `Math.random`), so the same seed plus the same player actions rebuild a city exactly.

* **Replay and timelapse**: record the player's actions with the tick they happened on, then play them back: a timelapse of the city growing, a rewind to before a disaster, and bug reports that come with a replay instead of "it broke somehow".
* **Sim fuzzer**: thousands of game-days of random building, demolishing and speed changes, checking invariants: the books balance, no stock goes negative, save and reload gives the same game, no walker is stuck forever. It finds bugs before players do.
* **Save corpus in CI**: keep a save from every release and prove each one still loads.
* **More in `npm run sweep`** (it runs every difficulty on every campaign map since v0.11.1): sandbox landscapes and seeds, and a garrison run.

## Beyond the original (optional, later)

Ideas that would change the original's economy or rules; each would come as an option:

* **Dynamic prices**: each partner's prices drift with what you sell to it. (Prices already differ by partner, province and year: a far partner trades at up to 25% more both ways, a province has its own market, and every good drifts each New Year, all from the map and the date, `sim/prices.js`. What is left here is the part that answers the player: a partner paying less for a good the more of it you sell it, and recovering when you stop.)
* **Partner contracts**: optional side jobs ("Carthago wants 800 wine by next year and pays 150%").
* **Deeper production chains**: salt pans, garum (fish and salt), a mill and bakery for bread, sheep to wool (a second source of cloth, beside the flax and linen built above).
* **Paved roads**: faster carts, higher cost.
* **Sewers and latrines**, paired with disease.
* **Edicts**: policies with trade-offs (a bread dole, a curfew, public games).
* **Climate per landscape**: deserts never snow, northern maps get long winters.
* **"Harsh seasons" mode**: weather affects the city (drought cuts harvests, snow slows carts).

## Polish ideas

* More building animation: turning mill wheels, laundry flapping, working farmers and fishermen.
* Optional sprite packs: load PNG art (hand-drawn or AI-assisted) over the procedural sprites, keyed like the sprite cache, with the procedural art as the fallback (Augustus can load outside images too). The art sheet (`tests/e2e/artsheet.html`) is the reference for sizes and anchors.
* Keyboard remapping and a colorblind-friendly overlay palette.
* Performance: cache static terrain into chunk canvases for the most zoomed-out view. When the screen is full of tiles (the middle of a Large or Uber map) that view costs about 16 ms a frame in headless Chromium against 4 ms one zoom level in; chunks would cut its thousands of ground draw calls to a few dozen (see ARCHITECTURE.md, *Draw calls*).
* Smaller saves for very big cities: buildings are about 0.8 KB each in a save (mostly the house record), so a 1,500-building capital needs about 1.5 MB per slot. Dropping default-valued fields, or compressing the whole save, would stretch the ~5 MB browser allowance further.
* **The capacity model and the Arena's longer walk** (v0.19.11): the model still plans the Great Arena's performers at 26 tiles, not 52; planning them at 52 lowers the job ceilings of missions 5 to 10 by 400 to 1,100 people, so it waits for the next look at the late missions' goals.
* **Voices and recorded sound (optional, later)**: original voices generated with a speech service for the walkers' lines when clicked, the advisors' messages and the mission briefings, and recorded ambience (a market's bustle, the arena's crowd, an orator in the forum), alongside the synthesized sound and music. A deliberate change from sound made wholly in code: the files add to the game's size, and the voices must be original (no cloned voices of real people).
* **A street-level camera (WebGL)**: tilt and turn the camera down to street height to see the 3D art up close, at first as a photo mode for looking round the city. It needs the common buildings and the walkers as 3D models first (the trees and rocks are 3D since v0.20.13): today's flat sprites are drawn for the overhead view and would read as cards lying on the ground from low down. 
* **The WebGL renderer, phase 2**: more 3D models, one building type at a time, then walkers and units; terrain relief; real lighting and shadows in place of the 2D shadow shapes and the night light map for what is still a sprite (the models cast real shadows already); the night lit in 3D, so water and stone catch the lamps; models fading in as they are built (they now pop in opaque while rising); overlays, coverage and signs merged into the scene's depth; a sprite atlas to cut the sprites' draw calls (the models are instanced already); loading three.js only for players who pick WebGL, so Classic players do not download its 543 KB.

## Decisions

* **Modern features**: pure quality of life (roadblocks, market special orders, partial warehouse storage, building rotation) is on by default. Changes to the original's rules (supply posts, the global labour pool, everything under "Beyond the original") come as options that default to the original. Exception: sea raids and the fleet are on by default, with a *Sea raids* switch (Settings, the sandbox setup) that makes every raid come by land as before.
* **Gods**: the original's five, Ceres, Neptune, Mercury, Mars and Venus. Mercury and Venus replace Jupiter and Vesta, and older saves map the old gods' moods over. (Built: item 14.) Festivals cost food and wine as well as money, and a god a year without one is neglected (the original's rule). The favourite and the jealous god (most and fewest temples) are the original's too, with Venus counted and staffed temples only (v0.18.11).
* **Housing**: the original's 20 levels, with Colonia's own names and numbers. Done in v0.7, ahead of disease and crime. Where the original has a plain bug, Colonia does not copy it and makes no option of it; behavior that is odd but possibly meant stays as the original had it.
* **Crime, disease and events**: on at every difficulty, as they always were in the original, and gentler on Easy.
* **Localization**: not planned.
* **Caesar's anger** (items 1, #1): as in the original, favor at 0 no longer recalls the governor. At favor 10 or less Caesar warns and sends his legions after 12 months (shown marching on the empire map); recovering favor sends them home, and the mission is lost only if they overrun the city.
* **Gifts and rank** (item 2, #6): the governor draws a salary by rank into personal savings, carried from mission to mission; gifts to Caesar come from those savings, as in the original. One rank a step, Citizen at step 1 to Proconsul at step 10; winning step 10 makes the governor Caesar (v0.17.0).
* **Monuments** (Colonia's own set, after the community engines' monuments): one per city, from six (a Great Sanctuary to one god, the Pantheon, the Lighthouse on sea routes, the Caravanserai on land routes, the Great Baths, the Hall of Justice), 5x5 but the 3x3 Lighthouse on the shore; from campaign step 6 (the Pantheon from 8), every one in the sandbox; never a mission goal (a finished one adds to the Hall of Fame score). One work camp kind both hauls and builds, its carts bringing goods only from warehouses (and granaries for its food); short of food or water it works at half pace, short of both it stops (a switch for a harsher rule later). A raid sets a site back (half the stage's work, a quarter of its goods; finished stages stand, no rubble), except on Insane, where raiders raze a site or a finished monument and everything is lost. The machinery takes a footprint size and stage tables as data, for Nova Roma's palace later.
* **Fishing boats take timber** (Colonia's own; the original's shipyard used nothing): 100 timber a boat, used at launch, carted in like a workshop's raw material, up to 200 in the yard. It puts the shipyard in the wood trade beside the carpenter, the fletcher and the Navalia, and gives a fleet lost to Neptune or raiders a price. Every mission with a shipyard has the timber yard and woods for it; Paestum and Portus Mercatorum have no partner selling timber, so there it is felled.
* **The fleet in distant battles** (Colonia's own): when the threatened city lies on a sea route, Naval Station squadrons can be sent with the forts' soldiers and count toward the battle.
* **Campaign branches** (#13): after a win the player chooses the next province, peaceful or military, both at the same rank, and may switch tracks at every split. First at steps 3, 4 and 5, each beside the existing mission: Firmum (military) beside Figlina, Paestum (peaceful) beside Pons Aelius, Beneventum (peaceful) beside Portus Mercatorum, all colonies of the 270s and 260s BC. Military provinces bring raids early, forts a step sooner and Caesar's requests for troops; peaceful ones no raids, more people (about a fifth more at steps 3 to 5, Figlina and Beneventum with trade of their own for the work) and higher culture and prosperity goals. Both ask for Caesar's favor from step 3.
* **Forts at rest and training** (from playtesting, as in the original): a fort that is not deployed holds its ground and fights only what comes to it (within about 2 tiles of its ranks, an archer within his range, or whoever strikes at a man); deploy it to fight in the field. At rest its men stand in its yard, inside the walls, and stand to on its ground outside while enemies are in the province. Recruits on their way to their fort (and new ships on their way to their station) pass the Campus (or the Portus); untrained men at rest (and ships at their berths) go too, one of a fort or station at a time and never its last, only while it is at rest (not deployed, nobody away, no enemy about, no warband a month away), and come straight back the moment its men would stand to or it is deployed (from playtesting: a fort of untrained men never went to the academy built after them). Training takes time: a month at the academy, 8 days at the Portus, counted only at full staff, the recruit's place in his fort held meanwhile.
* **Trade prices** (from playtesting; Colonia's own: the original had one price table, changed only by scripted events): prices vary by distance (the nearest partner at base, the farthest 25% dearer both ways), by province (each campaign province has 2 to 4 goods cheap or dear; the sandbox none) and from year to year (a seeded drift of up to 15%, pulled back toward the base). Derived from the map's seed and the date, never saved. Emperor requests and the capacity model do not read prices.
* **Names**: every building shows a Latin name, with its English name in the build menu and the inspect panel.
* **Music**: about 10 tracks of a few minutes for day, night and the menu, picked at random; festivals and raids keep their own music, also a few minutes long. The settings do not name the tracks; the console does (`music`, `music tracks`).
* **Saves**: until 1.0 a release may stop loading older saves (always with a readable message).
* **The renderer for 1.0**: the canvas renderer and procedural sprites stay through the 0.x releases while gameplay is fleshed out. A three.js (WebGL, MIT) renderer is the plan for 1.0: the same deterministic sim, procedural 3D models in place of the 2D sprites (no outside art), free rotation and tilt, real lighting and shadows, instancing for big maps. It starts as a proof of concept (one district in 3D beside the 2D view, measured for speed and file size) before the move; phase 1 shipped behind a setting (*Settings > Renderer*, WebGL beta: the same picture through three.js, and the well as the first 3D model).
* **Version numbers**: after 0.9 comes 0.10; 1.0 only when the game is ready for it. Since v0.17.0 every change is a patch release (0.17.1, 0.17.2...) until the next minor version is called for.

Made with ❤️ from your friendly hacker - er2oneousbit
