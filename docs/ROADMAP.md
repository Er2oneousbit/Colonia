# Roadmap

What exists, what Caesar III had that Colonia does not (yet), and how to modernize it. New feature requests are added here first; bugs are fixed right away.

## The plan: a remake, modernized

Colonia is a remake and modernization of Caesar III.
The original's rules, buildings and campaign shape are the core, rebuilt with original art, sound and text.
On top come the quality-of-life changes players now expect, many of them first seen in the community engines: Julius (the original's exact game logic on modern systems) and Augustus (Julius plus
gameplay improvements such as roadblocks, market special orders and monuments).

## Next up (suggested order)

1. **Logistics from the mods**: market special orders, partial warehouse storage, supply posts for forts, and roadblock permissions on gates, bridges, granaries and warehouses.
2. **Playtest the late campaign** (steps 6 to 10, v0.17.0): then decide what "The late missions need more jobs" below leaves open.

Alongside: the sim fuzzer and the save corpus, so all of this lands without breaking anyone's city.

The release history is in [CHANGELOG.md](CHANGELOG.md).

## Caesar III parity: what the original had that Colonia does not (yet)

Open items only; each keeps its number (#n) for good, so the changelog still points at it.
Done so far: #3 crime (v0.10.0), #4 disease (v0.11.0), #11 walker click-to-inspect (v0.9.0), #10 granary and warehouse orders, #12 the empire map and #14 the original's five gods (v0.12.0), #2 fishing
wharves and shipyards, #5 the hippodrome and #15 the Health, Education and Entertainment advisors (v0.13.0), #1 the Emperor's legions and distant battles, #6 the governor's residence, salary and
rank, #16 triumphal arches, #17 the Military Academy (with Colonia's own Portus) and #18 large temples (v0.14.0), #24 staged raid warnings and the legions' reminders (v0.15.7), #13 campaign branches,
a peaceful and a military province at every step from 3 to 10 (v0.15.0 and v0.17.0), #7 map rotation, the city seen from four sides (v0.18), #9 events (Rome's wage, trade disruptions, bad water, mine
collapses and floods, earthquakes, price changes, a new emperor and the gladiator revolt), #19 wolves, #21 enemy armies by region, each province raided by its own people, #25 two kinds of bridge, a
ship bridge every boat passes under and a low bridge none passes, #22 the Hall of Fame, a score for every campaign win and the career, and #20 native villages and the mission post, in Mutina, Luna and
the sandbox (v0.18.1).

* **#8** **Scenario/map editor**, which doubles as modding (missions saved as data files).
* **#23** **City sounds**: the original played each building's sounds near the camera. Ours would be synthesized (market chatter, forge clanks, gulls at the docks) and change as you zoom.

## Modernization: from the community engines

What Augustus (4.0) added to the original, checked against its manual and release notes, adapted to Colonia:

* **Roadblock permissions on gates, bridges, granaries and warehouses** (roadblocks themselves came in v0.9.0): only roaming service walkers are stopped.
  Anything with a destination (carts, caravans, settlers, market buyers) passes, so service coverage becomes a puzzle instead of a dice roll.
  Each roadblock carries a permission per group of walkers: maintenance (engineers and prefects), priests, the market vendor, entertainers, education, medicine, tax collectors, labor seekers,
  missionaries and watchmen, plus everyone else.
  Gates, bridges, granaries and warehouses can carry the same permissions.
  Roadblocks default to denying everyone.
* **Market special orders**: each market switches every good on or off (all on by default).
  The buyer only fetches goods that are on, and the vendor only hands out goods that are on and that the house's next level uses.
* **Partial warehouse storage** (Accept, Refuse and Get per good came in v0.12.0): a limit per good counted in loads (accept up to it, get up to it), and later versions' "maintain a reserve".
* **Supply posts**: fort soldiers eat. One post per map; its quartermaster fetches food from granaries, and shortages cut morale (an option; the original's rule is the default).
* **Global labour pool**: an option that removes the need for labor-seeking walkers to pass homes; every building with road access is fully staffed while enough citizens are unemployed, and category
  priorities still apply.
  The original's rule is the default.
* **Extended campaign**: after victory, the player can accept the promotion again or extend the regency, indefinitely.
* **Also in Augustus 4.0, candidates for later**: the **Cart Depot** (ox carts move goods between storage buildings on orders: source, destination, good, condition), the **Tavern** (wine, meat and fish
  give entertainment), the **Watchtower** (a cheaper tower that needs no weapons but needs a barracks), the **Highway** (a fast road that only destination walkers can use, with a cost per tile), and new
  materials (stone, sand, bricks, concrete, gold) with a **City Mint**.
* Already in Colonia: zoom, much bigger maps (Uber), a console, roadblocks, and per-good Accept, Refuse and Get orders with an Empty switch for granaries and warehouses.

## Modernization: Colonia's own

Seeing why:

* **Charts per good over time** (the Production advisor and the trend charts came in v0.9.1).
* **Production calculator**: turns a target into building counts (feeding 1,000 people takes about 3 full wheat farms).
* **Walker traffic heat map**: where walkers actually go, which shows where roadblocks belong.
* **Year in review** and a **city chronicle**: a yearly report card with charts, and an auto-written history of the city ("297 BC: the great fire of the east quarter took 14 homes").

* **Province mode** (Colonia's own, after SimCity 4's regions; a third way to play beside the campaign and the sandbox; on the main menu as "coming soon" since v0.19.2): a province split into city sites
  (on the empire map, or a grid), each an ordinary Colonia city the player founds and plays (a port, a mining town in the hills, a farming town on the plains).
  The player's own cities trade with each other as partners, through the existing routes, caravans, ships, prices and per-partner switches, their quotas taken from each city's real stock and surplus.
  As in SimCity 4, only the city being played runs: the others wait where they were left, and trade between them is settled when the player switches city, so nothing runs in the background and the sim
  stays deterministic.
  Shared: events, raids and Caesar's favor (to decide: one treasury, or each its own with transfers; an army sent to a neighbour's aid).
  Goals optional (none, or "a province of 50,000").
  Needs: saves in IndexedDB with compression (several cities outgrow the browser's 5 MB; Nova Roma needs it too), the province screen (found, pick and switch cities), own cities as trade partners in the
  trade code, and the province-wide rules.
* **Mission 11: Nova Roma** (Colonia's own, the campaign's finale; Constantine's refounding of Byzantium as Nova Roma is the model).
  After step 10 the player claims the purple; to make the claim stick they build a new Rome, and old Rome (the Senate and the great families, who want their power back) fights it.
  On an Uber map (256 tiles), the only mission there.
  * **The palace**, silly big and silly expensive: a footprint marked out whole as a construction site (a ghost of the finished palace, about 20x20 tiles, twenty-five times a Grand Palatium, with gardens
    and an artificial lake after Nero's Domus Aurea), built in stages over years (foundations, walls, colonnades, the golden hall, gardens and lake, a colossus of the new Caesar).
    Each stage wants absurd amounts of goods (thousands of marble, timber, bricks, furniture, wine, oil) and money.
    Finished, it employs a silly number of people (hundreds of servants, guards, gardeners and clerks), so it is also where a good part of the 20,000 citizens work.
    And it must be kept: finished, it consumes every good the city makes, in silly amounts and all the time (each food, wine, oil, furniture, pottery, clothing and the rest, delivered from storage like a
    palace-sized home), and a shortage dims it (its desirability, the governor's standing, the city's mood) until the supply comes back.
  * **The work camp**: a staging area by the site that oversees the building; its workers cart the goods in from storage and its builders (an architects' guild, as in Augustus's monuments) advance each
    stage.
    The camp must be fed and watered (food carted from the granaries, a well or fountain in reach): without them the work slows, then stops.
    The monuments of v0.19.0 already use the same machinery (stage tables, the Castra Operarum, upkeep), with the footprint size a parameter.
  * **Old Rome's answer**: from the moment the site is marked out, elite troops (Praetorian cohorts, stronger than any raider) march on it; each finished stage makes the next waves bigger and sooner, the
    last stages a siege.
    They make for the site: damage sets a stage back, so it must be walled and garrisoned.
  * **Gold** (for the Golden Hall's gilding; the game has none yet): to decide.
    Suggested: a rare gold mine on a few of the map's rock outcrops with a goldbeaters' workshop (bratteari) making gold leaf, topped up by gold imported from Hispania at a steep price (the Romans' gold
    came mostly from Hispania's mines, Las Medulas above all, and later Dacia's).
  * **To win**: the palace finished, at least 20,000 citizens, high ratings, and the city still standing. A Hall of Fame score of its own.
  * **Before it can be built**: footprints past 5x5 (the monuments' machinery, v0.19.0, takes the size as a parameter); the economy's jobs for 20,000 (the largest province today employs about 13,500:
    Puteoli), and settlers fast enough that 20,000 does not take decades; speed on an Uber map with thousands of walkers (the sim in a Web Worker, terrain chunk caching, below); saves that fit the
    browser's storage for a city that size (smaller saves, below).
* **Strike the raiders' base** (Colonia's own; the Romans' punitive campaigns against the Ligurians and Gauls are the model): once a raiding people has been scouted or beaten off a time or two, its camp
  appears on the empire map, and forts with Empire service can be sent against it like a distant battle.
  Months on the march there and back leave the city short of defenders.
  It needs a large army (the camp grows with every raid it has sent: something like two to three times its last warband), trained men counting more; liburnians could strike a sea raiders' base.
  A win stops that people's raids for a few years, lifts peace and brings some plunder; a defeat loses the men and brings the next raid sooner and bigger.
  Details to settle before building.
* **Friendly villages** (Colonia's own, after a playtest of the plain rules from parity #20): a village calmed for a year without a break becomes a friend; its trader then also sells (a good its land
  gives: timber, hides as meat, marble near Luna), and in a military mission its people's raids are smaller or put off while the friendship lasts.
  A raid by the same people that destroys a friend's work breaks it.
* **The late missions need more jobs**, what is left of it (the jobs groundwork came in v0.16.5, the late provinces in v0.17.0, every goal fitted to its jobs): after a playtest of the late steps,
  whether the military missions of steps 4 to 7 ask for more people again (Pons Aelius, Portus Mercatorum, Oasis Aurea and Urbs Magna ask for 63 to 77% of their ceilings of 3,510 to 8,160, where the
  peaceful provinces from step 3 ask for 83 to 90%; Portus Mercatorum's 3,900 is held down by Oasis Aurea's pace, so more people there means a longer Oasis Aurea too), whether big cities need more
  settlers (a 10,000 goal takes 12.6 years at the fastest, 12,000 take 15.4), whether raids should grow past their cap of 40 raiders for the largest provinces, and, only if play shows idle hands the
  capacity model does not, slower workshops (the original's pace).

From playtesting (still to decide which to take):

* **The early missions on Hard and Insane**: the sweep's demo city finds them harsh, partly because it builds what those missions do not unlock (`npm run sim -- --unlocks` builds only what they allow);
  measure again with it before changing anything.
* **Festival costs** (after v0.18.4): Colonia's small festival costs about 3.5 times the original's money (60 + 0.15 a citizen against the original's population / 20 + 10), and keeping five gods content
  now takes about five festivals a year; the food's one-load minimum is steep for a town just past 800 people.
  Whether to lower either.

Playing smoother:

* **Blueprints**: copy and paste housing blocks, and a ghost planner that builds each piece once you can afford it.
* **Pinned stats**: pin any good or rating to the top bar.
* **Per-building labor priority**, on top of the category priorities.
* **Custom difficulty**: sliders over the lever table (every lever already lives in one table).
* **Interactive tutorial mission**.
* **Photo mode**: hide the UI, pick the time of day, season and weather, save a screenshot.
* **Accessibility**: UI scale and a screen-reader pass (reduced motion is already honored).
* **Challenge games**: one-off scenarios outside the campaign, picked from a Challenges menu, each a fixed map with its own rules, goal and time limit, and a best result kept per difficulty.
  Ideas: hold a frontier town through ten raids; feed a desert city on imports alone; rebuild a burned city from its rubble; the Emperor's legions already marching when the game starts; a famine winter
  on Insane; grow to 2,000 people with no prefecture; a Venus festival city judged on mood alone; a million denarii to start but no trade and no Forum (no taxes: the fortune must last); a map with
  almost no farmland, where the city lives on food bought from its partners; Hordes, endless raids that start as a handful of raiders and grow with every wave, the city's score how many waves it
  outlasts.
  Each one names what it leaves out or adds, and its numbers are measured with the headless sim like a mission's.
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

* **Replay and timelapse**: record the player's actions with the tick they happened on, then play them back: a timelapse of the city growing, a rewind to before a disaster, and bug reports that come
  with a replay instead of "it broke somehow".
* **Sim fuzzer**: thousands of game-days of random building, demolishing and speed changes, checking invariants: the books balance, no stock goes negative, save and reload gives the same game, no walker
  is stuck forever.
  It finds bugs before players do.
* **Save corpus in CI**: keep a save from every release and prove each one still loads.
* **More in `npm run sweep`** (it runs every difficulty on every campaign map since v0.11.1): sandbox landscapes and seeds, and a garrison run.

## Beyond the original (optional, later)

Ideas that would change the original's economy or rules; each would come as an option:

* **Dynamic prices**: each partner's prices drift with what you sell to it.
  (Prices already differ by partner, province and year: a far partner trades at up to 25% more both ways, a province has its own market, and every good drifts each New Year, all from the map and the
  date, `sim/prices.js`.
  What is left here is the part that answers the player: a partner paying less for a good the more of it you sell it, and recovering when you stop.)
* **Partner contracts**: optional side jobs ("Carthago wants 800 wine by next year and pays 150%").
* **Deeper production chains**: salt pans, garum (fish and salt), a mill and bakery for bread, sheep to wool (a second source of cloth, beside the flax and linen built above).
* **Paved roads**: faster carts, higher cost.
* **Sewers and latrines**, paired with disease.
* **Edicts**: policies with trade-offs (a bread dole, a curfew, public games).
* **Climate per landscape**: deserts never snow, northern maps get long winters.
* **"Harsh seasons" mode**: weather affects the city (drought cuts harvests, snow slows carts).

## Polish ideas

* More building animation: turning mill wheels, laundry flapping, working farmers and fishermen.
* Optional sprite packs: load PNG art (hand-drawn or AI-assisted) over the procedural sprites, keyed like the sprite cache, with the procedural art as the fallback (Augustus can load outside images
  too).
  The art sheet (`tests/e2e/artsheet.html`) is the reference for sizes and anchors.
* Keyboard remapping and a colorblind-friendly overlay palette.
* Performance: cache static terrain into chunk canvases for the most zoomed-out view.
  When the screen is full of tiles (the middle of a Large or Uber map) that view costs about 16 ms a frame in headless Chromium against 4 ms one zoom level in; chunks would cut its thousands of ground
  draw calls to a few dozen (see ARCHITECTURE.md, *Draw calls*).
* Smaller saves for very big cities: buildings are about 0.8 KB each in a save (mostly the house record), so a 1,500-building capital needs about 1.5 MB per slot.
  Dropping default-valued fields, or compressing the whole save, would stretch the ~5 MB browser allowance further.
* **The capacity model and the Arena's longer walk** (v0.19.11): the model still plans the Great Arena's performers at 26 tiles, not 52; planning them at 52 lowers the job ceilings of missions 5 to 10
  by 400 to 1,100 people, so it waits for the next look at the late missions' goals.
* **Voices and recorded sound (optional, later)**: original voices generated with a speech service for the walkers' lines when clicked, the advisors' messages and the mission briefings, and recorded
  ambience (a market's bustle, the arena's crowd, an orator in the forum), alongside the synthesized sound and music.
  A deliberate change from sound made wholly in code: the files add to the game's size, and the voices must be original (no cloned voices of real people).
* **A street-level camera (WebGL)**: tilt and turn the camera down to street height to see the 3D art up close, at first as a photo mode for looking round the city.
  Since v0.30 nearly everything is 3D (buildings, homes at five levels, walkers, units, ships, trees and rocks); what is still a sprite (the other house levels, industry, projectiles, overlays) would
  read as cards lying on the ground from low down, so those come first.
* **The WebGL renderer, what is left** (status at v0.30.2):
  * Still sprites: the other house levels (Tent, Family Tent, Lean-to, Stone Cottage, Merchant House, Domus, and the villas and palatia from the Villa up), the dock and wharves among the industry
    buildings (the four raw producers and the eight workshops are models), the flying javelins and arrows.
  * Period check, what is left after v0.30.9 (the senate house, the warehouse, the Hall of Justice, the baths, the Great Baths, the Great Arena and the harbour works are of the Republic now): the
    prefecture and the engineer's post are still described as brick; the forts' and towers' stone could take the same look; the 2D sprites of the rebuilt monuments (render/monumentArt.js) still show the
    Imperial designs.
  * Below the bar, noted at release: venue crowds crude at 4x to 6x; mules, oxen, wolves, goats, sheep and the elephant toy-like close up; faces mannequin-like at extreme close range; steam and smoke
    faint; a first-build stall of 30 to 60 ms the first time the theater, the Arena, a monument stage or the tenement appears close up; the treadwheel crane's load vanishes at the top of its lift; zoomed
    out, the homes read redder than the plaster asked for.
  * Then: terrain relief; real lighting and shadows for what is still a sprite; the night lit in 3D, so water and stone catch the lamps; models fading in as they are built; overlays, coverage and signs
    merged into the scene's depth; a sprite atlas to cut the sprites' draw calls; loading three.js only for players who pick WebGL, so Classic players do not download it.

## Decisions

* **Modern features**: pure quality of life (roadblocks, market special orders, partial warehouse storage, building rotation) is on by default.
  Changes to the original's rules (supply posts, the global labour pool, everything under "Beyond the original") come as options that default to the original.
  Exception: sea raids and the fleet are on by default, with a *Sea raids* switch (Settings, the sandbox setup) that makes every raid come by land as before.
* **Gods**: the original's five, Ceres, Neptune, Mercury, Mars and Venus.
  Mercury and Venus replace Jupiter and Vesta, and older saves map the old gods' moods over.
  (Built: item 14.)
  Festivals cost food and wine as well as money, and a god a year without one is neglected (the original's rule).
  The favourite and the jealous god (most and fewest temples) are the original's too, with Venus counted and staffed temples only (v0.18.11).
* **Housing**: the original's 20 levels, with Colonia's own names and numbers.
  Done in v0.7, ahead of disease and crime.
  Where the original has a plain bug, Colonia does not copy it and makes no option of it; behavior that is odd but possibly meant stays as the original had it.
* **Crime, disease and events**: on at every difficulty, as they always were in the original, and gentler on Easy.
* **Localization**: not planned.
* **Caesar's anger** (items 1, #1): as in the original, favor at 0 no longer recalls the governor.
  At favor 10 or less Caesar warns and sends his legions after 12 months (shown marching on the empire map); recovering favor sends them home, and the mission is lost only if they overrun the city.
* **Gifts and rank** (item 2, #6): the governor draws a salary by rank into personal savings, carried from mission to mission; gifts to Caesar come from those savings, as in the original.
  One rank a step, Citizen at step 1 to Proconsul at step 10; winning step 10 makes the governor Caesar (v0.17.0).
* **Monuments** (Colonia's own set, after the community engines' monuments): one per city, from six (a Great Sanctuary to one god, the Pantheon, the Lighthouse on sea routes, the Caravanserai on land
  routes, the Great Baths, the Hall of Justice), 5x5 but the 3x3 Lighthouse on the shore; from campaign step 6 (the Pantheon from 8), every one in the sandbox; never a mission goal (a finished one adds
  to the Hall of Fame score).
  One work camp kind both hauls and builds, its carts bringing goods only from warehouses (and granaries for its food); short of food or water it works at half pace, short of both it stops (a switch for
  a harsher rule later).
  A raid sets a site back (half the stage's work, a quarter of its goods; finished stages stand, no rubble), except on Insane, where raiders raze a site or a finished monument and everything is lost.
  The machinery takes a footprint size and stage tables as data, for Nova Roma's palace later.
* **Fishing boats take timber** (Colonia's own; the original's shipyard used nothing): 100 timber a boat, used at launch, carted in like a workshop's raw material, up to 200 in the yard.
  It puts the shipyard in the wood trade beside the carpenter, the fletcher and the Navalia, and gives a fleet lost to Neptune or raiders a price.
  Every mission with a shipyard has the timber yard and woods for it; Paestum and Portus Mercatorum have no partner selling timber, so there it is felled.
* **The fleet in distant battles** (Colonia's own): when the threatened city lies on a sea route, Naval Station squadrons can be sent with the forts' soldiers and count toward the battle.
* **Campaign branches** (#13): after a win the player chooses the next province, peaceful or military, both at the same rank, and may switch tracks at every split.
  First at steps 3, 4 and 5, each beside the existing mission: Firmum (military) beside Figlina, Paestum (peaceful) beside Pons Aelius, Beneventum (peaceful) beside Portus Mercatorum, all colonies of
  the 270s and 260s BC.
  Military provinces bring raids early, forts a step sooner and Caesar's requests for troops; peaceful ones no raids, more people (about a fifth more at steps 3 to 5, Figlina and Beneventum with trade
  of their own for the work) and higher culture and prosperity goals.
  Both ask for Caesar's favor from step 3.
* **Forts at rest and training** (from playtesting, as in the original): a fort that is not deployed holds its ground and fights only what comes to it (within about 2 tiles of its ranks, an archer
  within his range, or whoever strikes at a man); deploy it to fight in the field.
  At rest its men stand in its yard, inside the walls, and stand to on its ground outside while enemies are in the province.
  Recruits on their way to their fort (and new ships on their way to their station) pass the Campus (or the Portus); untrained men at rest (and ships at their berths) go too, one of a fort or station at
  a time and never its last, only while it is at rest (not deployed, nobody away, no enemy about, no warband a month away), and come straight back the moment its men would stand to or it is deployed
  (from playtesting: a fort of untrained men never went to the academy built after them).
  Training takes time: a month at the academy, 8 days at the Portus, counted only at full staff, the recruit's place in his fort held meanwhile.
* **Trade prices** (from playtesting; Colonia's own: the original had one price table, changed only by scripted events): prices vary by distance (the nearest partner at base, the farthest 25% dearer
  both ways), by province (each campaign province has 2 to 4 goods cheap or dear; the sandbox none) and from year to year (a seeded drift of up to 15%, pulled back toward the base).
  Derived from the map's seed and the date, never saved.
  Emperor requests and the capacity model do not read prices.
* **Names**: every building shows a Latin name, with its English name in the build menu and the inspect panel.
* **Music**: about 10 tracks of a few minutes for day, night and the menu, picked at random; festivals and raids keep their own music, also a few minutes long.
  The settings do not name the tracks; the console does (`music`, `music tracks`).
* **Saves**: until 1.0 a release may stop loading older saves (always with a readable message).
* **The renderer for 1.0**: the canvas renderer and procedural sprites stay through the 0.x releases while gameplay is fleshed out.
  A three.js (WebGL, MIT) renderer is the plan for 1.0: the same deterministic sim, procedural 3D models in place of the 2D sprites (no outside art), free rotation and tilt, real lighting and shadows,
  instancing for big maps.
  It starts as a proof of concept (one district in 3D beside the 2D view, measured for speed and file size) before the move; phase 1 shipped behind a setting (*Settings > Renderer*, WebGL beta: the same
  picture through three.js, and the well as the first 3D model).
* **Version numbers**: after 0.9 comes 0.10; 1.0 only when the game is ready for it. Since v0.17.0 every change is a patch release (0.17.1, 0.17.2...) until the next minor version is called for.

Made with ❤️ from your friendly hacker - er2oneousbit
