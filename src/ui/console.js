/**
 * console.js
 * ----------------------------------------------------------------------------
 * In-game debug console (toggle with the backtick key). Meant for testers and
 * developers: give money, fast-forward, spawn disasters, inspect state.
 * No eval: only the commands listed in COMMANDS exist.
 * ----------------------------------------------------------------------------
 */

import { h } from './dom.js';
import { painterFor } from '../render3d/paint/painter.js';
import { GROUND_LAYERS } from '../render3d/ground/groundSurfaces.js';
import { CONFIG } from '../config.js';
import { GOODS } from '../data/goods.js';
import { BUILDINGS, MONUMENT_KEYS } from '../data/buildings.js';
import { buildDemoCity, buildDemoGarrison, buildDemoHarbor, buildDemoFishery, buildDemoHippodrome, buildDemoVenues, buildDemoCloth, buildDemoFarms, buildDemoNavy, buildDemoAcademy, buildDemoLearning, buildDemoHealth, buildDemoGardens, buildDemoPortus, buildDemoMonument, DEMO_YARD_TIMBER } from '../dev/demoCity.js';
import { buildDemoGovernment } from '../dev/demoCity.js';
import { buildDemoTemples, bookDemoShows } from '../dev/demoCity.js';
import { buildDemoTraining } from '../dev/demoCity.js';
import { MONUMENT_TYPES, monumentTotals } from '../data/monuments.js';
import { cityMonument } from '../sim/monumentEffects.js';
import { monumentSummary, monumentStatus } from './monumentInfo.js';
import { wharfBoat, boatStatus } from '../sim/fishing.js';
import { igniteBuilding, collapseBuilding } from '../sim/risk.js';
import { isStorage, storageCapacity, storageUsed, isStable, stableRoom } from '../sim/storage.js';
import { launchInvasion, threatSummary, garrisonCounts, enemyCount } from '../sim/military.js';
import { PEOPLES } from '../data/peoples.js';
import { addPackAt, packSummary } from '../sim/wildlife.js';
import { startRevolt } from '../sim/revolt.js';
import { squadronCounts, shipStatus } from '../sim/navy.js';
import { startMarch, launchLegion, legionCount, siegeOrder } from '../sim/legion.js';
import { requestTroops, fightBattle, archesToBuild } from '../sim/battle.js';
import { THREATENED_CITIES } from '../data/battles.js';
import { commitCrime, crimeChance, criminalsAbout, unhappiestHomes, crimeEnabled } from '../sim/crime.js';
import { outbreak, sickHomes, riskiestHomes, diseaseEnabled } from '../sim/disease.js';
import { applyEvent, eventCondition, startQuake, newEmperor, quakeSummary, tradeHaltText } from '../sim/events.js';
import { QUAKE_SIZES } from '../data/events.js';
import { UNIT_TYPES, FORT_CAPACITY, STATION_CAPACITY } from '../data/units.js';
import { WEATHER, SEASON_NAMES, seasonalKind, SNOW_LEVELS } from '../render/weather.js';
import { dayTime } from '../render/lighting.js';
import { MOODS, TRACKS } from '../audio/composer.js';
import { log } from '../core/debug.js';

export const CONSOLE_HELP = [
  ['help', 'List commands'],
  ['money <n>', 'Add n denarii (negative to remove)'],
  ['savings <n>', 'Add n denarii to the governor\'s personal savings (negative to remove)'],
  ['freebuild on|off', 'Construction costs nothing'],
  ['speed <0-4>', 'Set game speed'],
  ['days <n>', 'Fast-forward n days instantly'],
  ['demo [1-3]', 'Build the demo city layout'],
  ['give <good> <n>', 'Put goods into your warehouses/granaries'],
  ['fire', 'Set a random building on fire'],
  ['collapse', 'Collapse a random building'],
  ['favor <n>', 'Set the Emperor\'s favor (0-100)'],
  ['mood <n>', 'Set city sentiment (0-100)'],
  ['crime', 'Crime report: the year so far, criminals about, the unhappiest homes'],
  ['crime <kind>', 'The home under the cursor (or the unhappiest) sends out a protester, a thief or a riot now'],
  ['riot', 'Same as crime riot'],
  ['unrest <n>', 'Set the mood of every home (0-100); they drift back toward their targets'],
  ['health', 'Health report: city health, outbreaks this year, sick homes, the homes closest to an outbreak'],
  ['sick [id | x y]', 'The home under the cursor (or #id, or at x,y; else the one at most risk) falls sick now'],
  ['event', 'Events report: Rome\'s wage, trade stopped, an earthquake shaking, the events so far'],
  ['event <kind>', 'An event now: wageup | wagedown | land | sea | water | mine | clay | quake [small|medium|large] | emperor'],
  ['garrison', 'Build a barracks, three forts, towers, a ranch and a wall (equipped, and military labor goes first)'],
  ['harbor', 'Build a dock + warehouse and open every sea route (river/coast maps)'],
  ['monument <key> [stock|done]', 'Build a monument\'s site (fanum_mars, pantheum, pharus, mansio_magna, thermae, basilica...) beside the city with a work camp, a well and a warehouse; "stock" fills the warehouse with every stage\'s goods, "done" finishes it at once'],
  ['monument', 'Report on the city\'s monument: its stage, goods, work and what holds it up'],
  ['fishing', 'Build a shipyard (stocked with timber), two fishing wharves and a granary on the nearest water with fish'],
  ['grounds', 'List the fishing grounds, and every wharf and its boat'],
  ['hippodrome', 'Build a Circus (hippodrome) and a Factio (chariot stable) beside the city'],
  ['arena', 'Build an Arena (Great Arena), an amphitheater, a gladiator school and a menagerie beside the city'],
  ['shows', 'Book every show at every venue for a month (plays, bouts, a hunt, races), building an Arena, an amphitheater and a Circus beside the city first if it has none'],
  ['cloth', 'Build the cloth industry beside the city: a Linarium, a Textrinum, a Taberna Vestiaria and a Horreum'],
  ['farms', 'Build one farm of every kind (at different steps of their year), a horse ranch and a stocked granary beside the city'],
  ['navy', 'Build a naval station and a navalia on the shore, stocked for a squadron of liburnians (river/coast maps)'],
  ['academy', 'Build a Campus (military academy) near the city, and a Portus by the first Statio if there is one (they train only at full staff)'],
  ['learning', 'Build a library and an academy near the city (and a school if it has none)'],
  ['government [house|villa|palace]', 'Build a senate house near the city (if it has none) and the governor\'s residence of that grade (default: palace), taking down the one standing'],
  ['gardens [n] [wild]', 'Lay out n gardens (default 24) in blocks beside the city, statues of each size, a gardeners\' yard and a triumphal arch across a road; "wild" leaves every garden and statue untended'],
  ['temples [n]', 'Build a small temple of each god (n of each, default 1), a grand temple of each, the oracle and (where there are native villages) the mission post near the city'],
  ['training', 'Build an actor troupe, a gladiator school, a menagerie and a chariot stable near the city'],
  ['healing', 'Build baths (piping water to the town if none reaches) and a hospital near the city, and a barber and a physician if it has none'],
  ['invade [n] [people]', 'Launch a raid of n warriors right now (default: normal size), of the province\'s people or of one named: gauls, boii, ligurians, carthaginians, lusitanians, cimbri, barbarians...'],
  ['searaid [n]', 'Launch a raid of n warriors by sea right now (river/coast maps; default: normal size)'],
  ['wolves [here]', 'List the wolf packs; "here" sets a new pack down near the middle of the view'],
  ['revolt', 'The gladiators revolt now, for 3 months (needs a working gladiator school)'],
  ['legion', 'Caesar\'s legions set out from Rome now (they arrive in 12 months)'],
  ['legion now [n]', 'Caesar\'s legions (n men; default: the next attack\'s size) arrive at the map entrance now'],
  ['battle [city] [n]', `Caesar calls for troops now: city ${Object.keys(THREATENED_CITIES).join(' | ')}, enemy strength n`],
  ['battle now', 'Fight the pending distant battle now'],
  ['arch', 'Grant a triumphal arch to build, as for a distant battle won'],
  ['army', 'List forts, naval stations, soldiers, ships, barracks and navalia stock and the raid schedule'],
  ['win', 'Trigger victory'],
  ['stats', 'Print city statistics'],
  ['goto <x> <y>', 'Center the view on a tile'],
  ['view [0-3]', 'Turn the view: the city 0 to 3 quarter turns clockwise (as Q does one at a time)'],
  ['weather <kind>', 'Change the weather now: clear | cloudy | rain | storm | snow'],
  ['snow <0-3>', 'Set the snow lying on the ground (0 none .. 3 deep); it melts again by itself'],
  ['sky <0-1>|off', 'Freeze the time of day (0.3 noon, 0.67 sunset, 0.8 night) or let it run'],
  ['ground [auto|high|low|off]', 'The WebGL renderer\'s ground: 3D at high or low quality, or flat sprites (off), to compare'],
  ['textures', 'The 3D textures, painted on the GPU: whether the ground\'s layers are in, and what painting them cost'],
  ['scale [auto|1|0.75|0.5]', 'The WebGL renderer\'s render scale: the share of the device pixels its 3D scene is drawn with'],
  ['perf [on|off]', 'The performance readout: frames a second, ms by stage, the GPU in use (F3 shows it in a corner)'],
  ['models', 'The WebGL renderer\'s 3D models: ready, or what they wait for, and the looks built'],
  ['flora [on|off]', 'The WebGL renderer\'s 3D trees and rocks (with the 3D ground): what is drawn, its level of detail and memory; off draws their sprites, to compare'],
  ['music [on|off|next]', 'Music status, switch it, or skip to a new piece'],
  ['music tracks', 'List the music tracks (and the moods they play in)'],
  ['music play <track>', 'Play a track now, by name (e.g. music play prima lux)'],
  ['music mood <m>|auto', 'Force a mood: menu, day, night, danger, festival (auto = follow the game)'],
  ['music wav [mood] [s]', 'Render music offline and download it as a WAV file (default: day, 60 s)'],
  ['music check', 'Render every mood offline and print its loudness (finds silent or clipping music)'],
  ['loglevel <lvl>', 'error | warn | info | debug'],
  ['clear', 'Clear the console'],
];

export class DebugConsole {
  constructor(app, root) {
    this.app = app;
    this.out = h('div', { class: 'out' });
    this.input = h('input', { id: 'console-input', type: 'text', placeholder: 'Type a command (help)', autocomplete: 'off', spellcheck: 'false', onkeydown: (e) => this.onKey(e) });
    this.el = h('div', { id: 'console', class: 'hidden' }, this.out, this.input);
    this.history = [];
    this.hIndex = 0;
    root.appendChild(this.el);
    this.print('Colonia debug console. Type "help".');
  }

  get open() { return !this.el.classList.contains('hidden'); }

  toggle() {
    this.el.classList.toggle('hidden');
    if (this.open) setTimeout(() => this.input.focus(), 0);
    else this.input.blur();
  }

  print(text, cls = '') {
    this.out.appendChild(h('div', { class: cls }, text));
    this.out.scrollTop = this.out.scrollHeight;
  }

  onKey(e) {
    if (e.key === 'Enter') {
      const cmd = this.input.value.trim();
      this.input.value = '';
      if (!cmd) return;
      this.history.push(cmd);
      this.hIndex = this.history.length;
      this.print(`> ${cmd}`);
      try {
        const res = this.run(cmd);
        if (res) this.print(res);
      } catch (err) {
        this.print(`Error: ${err.message}`);
        log.error('Console command failed:', err);
      }
    } else if (e.key === 'ArrowUp') {
      this.hIndex = Math.max(0, this.hIndex - 1);
      this.input.value = this.history[this.hIndex] || '';
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      this.hIndex = Math.min(this.history.length, this.hIndex + 1);
      this.input.value = this.history[this.hIndex] || '';
      e.preventDefault();
    }
  }

  /** Execute one command line. Returns text to print. */
  run(line) {
    const [cmd, ...args] = line.split(/\s+/);
    const app = this.app;
    const g = app.game;
    const need = () => { if (!g) throw new Error('No game running'); };
    switch (cmd.toLowerCase()) {
      case 'help':
        return CONSOLE_HELP.map(([k, v]) => `${k.padEnd(18)} ${v}`).join('\n');
      case 'clear':
        this.out.replaceChildren();
        return '';
      case 'money': {
        need();
        const n = Number(args[0]);
        if (!Number.isFinite(n)) throw new Error('usage: money <n>');
        g.city.treasury += n;
        return `Treasury: ${Math.round(g.city.treasury)} Dn`;
      }
      case 'savings': {
        need();
        const n = Number(args[0]);
        if (!Number.isFinite(n)) throw new Error('usage: savings <n>');
        const gv = g.city.governor;
        gv.savings = Math.max(0, Math.floor(gv.savings + n));
        return `Savings: ${gv.savings} Dn`;
      }
      case 'freebuild':
        need();
        g.cheats.freeBuild = args[0] !== 'off';
        if (g.cheats.freeBuild) g.city.flags.freeBuilt = true; // (the Hall of Fame scores no city built for free)
        return `Free build ${g.cheats.freeBuild ? 'ON' : 'OFF'}`;
      case 'speed': {
        const n = Number(args[0]);
        if (!(n >= 0 && n < CONFIG.SPEEDS.length)) throw new Error('usage: speed <0-4>');
        if (n === 0) app.paused = true;
        else app.setSpeed(n);
        return `Speed ${n}`;
      }
      case 'days': {
        need();
        const n = Math.min(3650, Math.max(1, Number(args[0]) || 16));
        const t0 = performance.now();
        g.runDays(n);
        return `Ran ${n} days in ${Math.round(performance.now() - t0)} ms. Date: ${g.time.label()}`;
      }
      case 'demo': {
        need();
        const res = buildDemoCity(g, { level: Number(args[0]) || 2 });
        if (res.center) app.renderer.camera.centerOnTile(res.center.x, res.center.y);
        return res.ok ? `Demo city built (${res.farms} farms).` : `Demo failed: ${res.reason}`;
      }
      case 'give': {
        need();
        const good = args[0];
        const n = Number(args[1]) || 400;
        if (!GOODS[good]) throw new Error(`unknown good. Options: ${Object.keys(GOODS).join(', ')}`);
        let left = n;
        // Horses go to the Horse Ranches' stables: no warehouse keeps them.
        const kept = !!GOODS[good].keptAt;
        for (const b of g.buildings.values()) {
          if (left <= 0) break;
          if (kept ? !isStable(b, good) : !isStorage(b) || b.stock[good] === undefined) continue;
          const room = kept ? stableRoom(b) : storageCapacity(b) - storageUsed(b);
          const put = Math.min(room, left);
          b.stock[good] += put;
          left -= put;
        }
        const where = kept ? `an ${BUILDINGS[GOODS[good].keptAt].name} with room` : 'a granary/warehouse';
        return left > 0 ? `Stored ${n - left}; no room for ${left} (build ${where}).` : `Stored ${n} ${good}.`;
      }
      case 'fire':
      case 'collapse': {
        need();
        const list = [...g.buildings.values()];
        if (!list.length) return 'Nothing to destroy.';
        const b = list[g.rng.int(list.length)];
        if (cmd === 'fire') igniteBuilding(g, b);
        else collapseBuilding(g, b);
        app.renderer.camera.centerOnTile(b.x, b.y);
        return `${cmd} at ${b.x},${b.y}`;
      }
      case 'favor':
        need();
        g.city.ratings.favor = Math.max(0, Math.min(100, Number(args[0]) || 50));
        return `Favor ${g.city.ratings.favor}`;
      case 'mood':
        need();
        g.city.sentiment = Math.max(0, Math.min(100, Number(args[0]) || 50));
        return `Sentiment ${g.city.sentiment}`;
      case 'crime':
      case 'riot': {
        need();
        const kind = cmd.toLowerCase() === 'riot' ? 'riot' : { protest: 'protester', protester: 'protester', thief: 'thief', riot: 'riot' }[(args[0] || '').toLowerCase()];
        if (!kind) {
          if (args[0]) throw new Error('usage: crime [protest|thief|riot]');
          return crimeReport(g);
        }
        const b = homeAtCursor(app, g) || unhappiestHome(g);
        if (!b) return 'No one lives in the city yet.';
        const w = commitCrime(g, b, kind);
        app.renderer.camera.centerOnTile(b.x, b.y);
        return w ? `A ${kind} from the home at ${b.x},${b.y}.` : `Nothing happened at ${b.x},${b.y}: no road close enough.`;
      }
      case 'unrest': {
        need();
        const n = Number(args[0]);
        if (!(n >= 0 && n <= 100)) throw new Error('usage: unrest <0-100>');
        let homes = 0;
        for (const b of g.buildings.values()) if (b.house && b.house.pop > 0) { b.house.mood = Math.round(n); homes++; }
        return `${homes} homes now at mood ${Math.round(n)}.`;
      }
      case 'health':
        need();
        return healthReport(g);
      case 'event': {
        need();
        const kind = (args[0] || '').toLowerCase();
        if (!kind) return eventReport(g);
        if (kind === 'quake') {
          const size = args[1] || 'small';
          if (!QUAKE_SIZES[size]) throw new Error(`usage: event quake [${Object.keys(QUAKE_SIZES).join('|')}]`);
          const q = startQuake(g, size);
          return q ? `${quakeSummary(g)}.` : 'No earthquake: one is already shaking, or there is no city to strike.';
        }
        if (kind === 'emperor') { newEmperor(g); return 'A new Caesar rules: favor is 50.'; }
        const key = { wageup: 'wageUp', wagedown: 'wageDown', land: 'land', sea: 'sea', water: 'water', mine: 'mine', clay: 'clay' }[kind];
        if (!key) throw new Error(`usage: event [${EVENT_KINDS}]`);
        if (!eventCondition(g, key)) return `It cannot happen now (${EVENT_NEEDS[key]}).`;
        applyEvent(g, key, g.rng.range(1, 4)); // (a wage event's step, as the month's draw gives)
        return `${key}: done.`;
      }
      case 'sick': {
        need();
        const b = pickHome(app, g, args);
        if (!b) return 'No one lives in the city yet (or no home there).';
        const dead = outbreak(g, b, 'console');
        app.renderer.camera.centerOnTile(b.x, b.y);
        if (!dead) return `The home at ${b.x},${b.y} is already sick.`;
        return b.house.sick > 0 ? `The home at ${b.x},${b.y} fell sick: ${dead} died, ${b.house.pop} sick for ${b.house.sick} days.` : `The home at ${b.x},${b.y} fell sick: all ${dead} died.`;
      }
      case 'garrison':
      case 'harbor': {
        need();
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        if (cmd === 'garrison') {
          const res = buildDemoGarrison(g, center, { stock: true, militaryFirst: true });
          if (res.barracks) app.renderer.camera.centerOnTile(res.barracks.x, res.barracks.y);
          return res.ok ? `Garrison built: ${res.forts.length} forts, ${res.towers.length} towers, ${res.wall} wall tiles. Military labor now goes first (Labor advisor). Recruits arrive over the next weeks.` : 'Could not find room for a barracks and forts near the city.';
        }
        const res = buildDemoHarbor(g, center);
        if (res.dock) app.renderer.camera.centerOnTile(res.dock.x, res.dock.y);
        return res.ok ? `Harbor built; sea routes opened: ${res.routes.join(', ') || 'none in this scenario'}.` : 'No navigable shore near the city (try a river or coast map).';
      }
      case 'monument': {
        need();
        const have = cityMonument(g);
        if (!args[0]) return have ? `${monumentSummary(g, have)} ${monumentStatus(g, have).text}` : 'No monument in this city. Try: monument basilica';
        const key = args[0];
        if (BUILDINGS[key]?.kind !== 'monument') throw new Error(`usage: monument <${MONUMENT_KEYS.join('|')}> [stock|done]`);
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        let site = have && have.type === key ? have : null;
        let camp = null;
        let warehouse = null;
        if (!site) {
          if (have) return `Your city raises one monument: the ${have.def.name}.`;
          const res = buildDemoMonument(g, center, key);
          if (!res.ok) return res.site ? 'No room near its site for a work camp and a warehouse.' : `No room for a ${BUILDINGS[key].name} near the city${BUILDINGS[key].placement === 'shore' ? ' (it needs a shore ships can reach)' : ''}, or it is not offered here.`;
          ({ site, camp, warehouse } = res);
        }
        app.renderer.camera.centerOnTile(site.x + 1, site.y + 1);
        if (args[1] === 'done') {
          site.mon.stage = MONUMENT_TYPES[site.def.mon].stages.length;
          site.mon.work = 0;
          site.mon.got = {};
          site.mon.way = {};
          const store = MONUMENT_TYPES[site.def.mon].store;
          if (store) site.mon.store = store.cap;
          g.markDirty('des');
          g.map.touch();
          return `The ${site.def.name} is finished (staff it to open it).`;
        }
        if (args[1] === 'stock' && warehouse) {
          for (const [good, n] of Object.entries(monumentTotals(site.def.mon).goods)) warehouse.stock[good] = (warehouse.stock[good] || 0) + n;
        }
        return `${site.def.name} site placed${camp ? `, a work camp at ${camp.x},${camp.y}` : ''}${args[1] === 'stock' ? ', its warehouse stocked with every stage\'s goods' : ''}.`;
      }
      case 'arena': {
        need();
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        const res = buildDemoVenues(g, center);
        if (res.colosseum) app.renderer.camera.centerOnTile(res.colosseum.x + 2, res.colosseum.y + 2);
        const built = Object.entries(res).filter(([, b]) => b).map(([k]) => BUILDINGS[k].name);
        return res.colosseum ? `Built: ${built.join(', ')}.` : 'No room for an Arena (5 x 5 clear tiles) near the city, or it is locked in this mission.';
      }
      case 'shows': {
        need();
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        const has = (t) => [...g.buildings.values()].some((b) => b.type === t);
        if (!has('colosseum') || !has('amphitheater')) buildDemoVenues(g, center);
        if (!has('hippodrome')) buildDemoHippodrome(g, center);
        const n = bookDemoShows(g);
        return n ? `Shows booked at ${n} venue${n === 1 ? '' : 's'} (they play while staffed).` : 'No venues to book.';
      }
      case 'fishing':
      case 'cloth':
      case 'hippodrome': {
        need();
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        if (cmd === 'fishing') {
          const res = buildDemoFishery(g, center);
          if (res.shipyard) app.renderer.camera.centerOnTile(res.shipyard.x, res.shipyard.y);
          return res.ok ? `Fishing quarter built: a shipyard stocked with ${DEMO_YARD_TIMBER} timber (${DEMO_YARD_TIMBER / CONFIG.SHIPYARD_BOAT_TIMBER} boats), ${res.wharves.length} wharves${res.granary ? ' and a granary' : ''}. The first boat comes in ${CONFIG.SHIPYARD_BOAT_DAYS} days at full staff.` : 'No water with fishing grounds near the city (try a coast or river map).';
        }
        if (cmd === 'cloth') {
          const res = buildDemoCloth(g, center);
          if (res.linen) app.renderer.camera.centerOnTile(res.linen.x, res.linen.y);
          if (res.ok) return 'Cloth industry built: a Linarium, a Textrinum, a Taberna Vestiaria and a Horreum. Homes need clothing from the Insula up.';
          return res.farm || res.linen ? 'Cloth industry only partly built (no room, or no meadow for the Linarium).' : 'No room for the cloth industry near the city (the Linarium needs meadow), or it is locked in this mission.';
        }
        const res = buildDemoHippodrome(g, center);
        if (res.hippodrome) app.renderer.camera.centerOnTile(res.hippodrome.x + 7, res.hippodrome.y + 2);
        return res.hippodrome ? `Circus built${res.maker ? ', with a Factio' : ' (no room for a Factio)'}.` : 'No room for a Circus (15 x 5 clear tiles) near the city, or there is one already.';
      }
      case 'farms': {
        need();
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        const res = buildDemoFarms(g, center);
        const at = res.granary || res.farms[0];
        if (at) app.renderer.camera.centerOnTile(at.x + 1, at.y + 1);
        return res.ok ? `Built ${res.farms.length} farms (${res.farms.map((b) => b.type).join(', ')})${res.granary ? ' and a stocked granary' : ''}.` : 'No meadow for farms near the city, or they are locked in this mission.';
      }
      case 'grounds': {
        need();
        const lines = g.map.fishingGrounds.map((gr, n) => `Ground ${n + 1} at ${gr.x},${gr.y} (water #${gr.body})`);
        if (!lines.length) lines.push('No fishing grounds on this map (no river, sea or lake of 80+ tiles).');
        for (const b of g.buildings.values()) {
          if (b.def.kind !== 'wharf') continue;
          const boat = wharfBoat(g, b);
          lines.push(`${b.def.name} #${b.id} at ${b.x},${b.y}: ${boat ? boatStatus(g, b) : 'no boat'}, ${b.stock.fish || 0} fish, ${b.catches || 0} catches, staff ${Math.round(b.efficiency * 100)}%`);
        }
        return lines.join('\n');
      }
      case 'navy': {
        need();
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        const res = buildDemoNavy(g, center, { stock: true });
        if (res.station) app.renderer.camera.centerOnTile(res.station.x, res.station.y);
        if (res.ok) return `Fleet built: a Statio and a Navalia stocked for ${STATION_CAPACITY} liburnians (one every ${CONFIG.NAVALIA_BUILD_DAYS} days at full staff; military labor may need to go first).`;
        return res.station ? 'A Statio was built, but no room for a Navalia on its water.' : 'No shore near the city that ships can reach (try a river or coast map), or the fleet is locked in this mission.';
      }
      case 'academy': {
        need();
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        const academy = buildDemoAcademy(g, center);
        const station = [...g.buildings.values()].find((b) => b.def.kind === 'station');
        const portus = station ? buildDemoPortus(g, station) : null;
        const shown = academy || portus;
        if (shown) app.renderer.camera.centerOnTile(shown.x, shown.y);
        const parts = [academy ? `a Campus at ${academy.x},${academy.y}` : null, portus ? `a Portus at ${portus.x},${portus.y}` : null].filter(Boolean);
        return parts.length ? `Built ${parts.join(' and ')}. They train only at full staff (military labor may need to go first).` : 'No room for a Campus near the city, or it is locked in this mission.';
      }
      case 'learning': {
        need();
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        const built = buildDemoLearning(g, center);
        const shown = built.academy || built.library || built.school;
        if (shown) app.renderer.camera.centerOnTile(shown.x + 1, shown.y + 1);
        const parts = Object.entries(built).map(([k, b]) => (b ? `${k} at ${b.x},${b.y}` : `no ${k}`));
        return `Learning: ${parts.join(', ')}.`;
      }
      case 'government': {
        need();
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        const grade = ['house', 'villa', 'palace'].includes(args[0]) ? args[0] : 'palace';
        const built = buildDemoGovernment(g, center, grade);
        const shown = built.residence || built.senate;
        if (shown) app.renderer.camera.centerOnTile(shown.x + shown.size / 2, shown.y + shown.size / 2);
        const parts = Object.entries(built).map(([k, b]) => (b ? `${k} (${b.type}) at ${b.x},${b.y}` : `no ${k}`));
        return `Government: ${parts.join(', ')}.`;
      }
      case 'gardens': {
        need();
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        const wild = args.includes('wild');
        const n = Math.max(0, Math.min(400, Number(args.find((a) => /^\d+$/.test(a))) || (wild ? 0 : 24)));
        const built = n ? buildDemoGardens(g, center, { count: n }) : null;
        if (wild) {
          // Untended for months: as far down as their care goes (sim/gardens.js).
          for (const b of g.buildings.values()) {
            if (!b.def.tended) continue;
            b.tendedDay = g.time.totalDays - 400;
            b.careStep = CONFIG.CARE_LEVELS.length - 1;
          }
          g.dirty.des = true;
        }
        if (built && built.arch) app.renderer.camera.centerOnTile(built.arch.x + 1, built.arch.y + 1);
        return built
          ? `Gardens: ${built.gardens} gardens, ${built.statues} statues, ${built.yard ? 'a gardeners\' yard' : 'no yard'}, ${built.arch ? `an arch at ${built.arch.x},${built.arch.y}` : 'no arch (no straight road it fits)'}${wild ? '; all left untended' : ''}.`
          : 'Every garden and statue left untended.';
      }
      case 'temples': {
        need();
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        const n = Math.max(1, Math.min(20, Number(args[0]) || 1));
        const { built, missing } = buildDemoTemples(g, center, { count: n });
        if (built.length) app.renderer.camera.centerOnTile(built[0].x + built[0].size / 2, built[0].y + built[0].size / 2);
        return `Temples: built ${built.length} (${[...new Set(built.map((b) => b.type))].join(', ')})${missing.length ? `; no room or locked: ${missing.join(', ')}` : ''}.`;
      }
      case 'training': {
        need();
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        const built = buildDemoTraining(g, center);
        const shown = Object.values(built).find(Boolean);
        if (shown) app.renderer.camera.centerOnTile(shown.x + shown.size / 2, shown.y + shown.size / 2);
        return `Training: ${Object.entries(built).map(([k, b]) => (b ? `${k} at ${b.x},${b.y}` : `no ${k}`)).join(', ')}.`;
      }
      case 'healing': {
        need();
        const center = cityCenter(g);
        if (!center) return 'Build some homes first (try: demo 2).';
        const built = buildDemoHealth(g, center);
        const shown = built.hospital || built.baths || built.clinic || built.barber;
        if (shown) app.renderer.camera.centerOnTile(shown.x + shown.size / 2, shown.y + shown.size / 2);
        const parts = Object.entries(built).map(([k, b]) => (b ? `${k} at ${b.x},${b.y}` : `no ${k}`));
        return `Healing: ${parts.join(', ')}.`;
      }
      case 'invade':
      case 'searaid': {
        need();
        if (g.military.active) return 'A raid is already under way.';
        // A people may come first or second ("invade gauls", "invade 12 gauls").
        const folk = args.find((a) => Object.hasOwn(PEOPLES, a)) || null;
        const num = args.find((a) => /^\d+$/.test(a));
        const n = num ? Math.max(1, Math.min(60, Number(num) || 0)) : 0;
        const sea = cmd.toLowerCase() === 'searaid';
        if (sea && !g.military.seaRaids) return 'Sea raids are off in this city (Settings).';
        const inv = launchInvasion(g, null, n || undefined, { sea, people: folk });
        app.renderer.camera.centerOnTile(inv.origin.x, inv.origin.y);
        if (sea && !inv.sea) return `No landing could be found, so a raid of ${inv.size} came by land from ${inv.origin.x},${inv.origin.y}.`;
        const who = PEOPLES[inv.people]?.mix ? ` ${PEOPLES[inv.people].name}` : '';
        return inv.sea ? `Raid of ${inv.size}${who} by sea in ${inv.ships} ship${inv.ships === 1 ? '' : 's'}, landing at ${inv.origin.x},${inv.origin.y}.` : `Raid of ${inv.size}${who} launched from ${inv.origin.x},${inv.origin.y}.`;
      }
      case 'wolves': {
        // Wolf packs (sim/wildlife.js): list them, or set one down here.
        need();
        if (args[0] === 'here') {
          const cam = app.renderer.camera;
          const c = cam.screenToTile(cam.viewW / cam.dpr / 2, cam.viewH / cam.dpr / 2);
          const pack = addPackAt(g, c.x, c.y);
          return pack ? `A pack of ${pack.size} wolves near ${pack.spot.x},${pack.spot.y}.` : 'No open land near the middle of the view for a pack.';
        }
        const wl = g.wildlife;
        if (!wl || !wl.packs.length) return wl && wl.nextPackId > 1 ? 'Every pack has been cleared.' : 'No wolves in this province. "wolves here" sets a pack down.';
        return [...wl.packs.map((p) => `Pack ${p.id}: ${packSummary(g, p)} (den ${p.den.x},${p.den.y})`),
          `Killed ${wl.stats.wolvesKilled} wolves; wolves have killed ${wl.stats.walkersKilled} people.`].join('\n');
      }
      case 'revolt': {
        need();
        if (!startRevolt(g)) return 'No revolt: one is on already, or no gladiator school is working (staffed, with a road).';
        return `The gladiators revolt until month ${g.military.revolt.endMonth}: ${g.military.revolt.turned} turned at once.`;
      }
      case 'legion': {
        // Caesar's legions (sim/legion.js): set them marching, or bring them now.
        need();
        const cs = g.military.caesar;
        if (cs.army) return `Caesar's legions are already in the province: ${legionCount(g)} of ${cs.army.size} left.`;
        if (args[0] === 'now') {
          const n = args[1] ? Math.max(1, Math.min(150, Number(args[1]) || 0)) : 0;
          const army = launchLegion(g, n);
          if (!army) return 'The legions could not get in: the map entrance is shut in.';
          app.renderer.camera.centerOnTile(g.map.entry.x, g.map.entry.y);
          return `${army.size} imperial legionaries arrive at the map entrance (attack ${cs.attacks}).`;
        }
        if (cs.countdown > 0) return `Caesar's legions (${cs.size}) are already marching: ${cs.countdown} days to go. "legion now" brings them at once.`;
        startMarch(g);
        return `Caesar's legions (${cs.size}) set out from Rome: they arrive in ${cs.countdown} days. Favor ${Math.floor(g.city.ratings.favor)}: ${siegeOrder(g.difficulty, g.city.ratings.favor, 1)} on arrival.`;
      }
      case 'battle': {
        // Distant battles (sim/battle.js): a call for troops now, or its battle now.
        need();
        const b = g.military.battle;
        if (args[0] === 'now') {
          if (!b || b.phase !== 'pending') return 'No battle is pending. "battle [city] [strength]" asks for troops.';
          fightBattle(g);
          return `The battle at ${THREATENED_CITIES[b.city].name} is fought: ${b.outcome}.`;
        }
        if (b) return `A battle is already going on (${THREATENED_CITIES[b.city].name}, ${b.phase}). "battle now" fights it.`;
        const city = THREATENED_CITIES[args[0]] ? args[0] : 'placentia';
        const strength = Math.max(1, Number(args[1]) || Number(args[0]) || 16);
        requestTroops(g, city, strength);
        return `Caesar asks for troops for ${THREATENED_CITIES[city].name} against strength ${strength}; the battle in ${g.military.battle.due - g.time.totalMonths} months. Cities: ${Object.keys(THREATENED_CITIES).join(', ')}.`;
      }
      case 'arch': {
        need();
        g.city.archesEarned = (g.city.archesEarned || 0) + 1;
        app.ui.sidebar?.renderList?.();
        return `A triumphal arch to build (Government & Decor, across a straight road): ${archesToBuild(g)} now.`;
      }
      case 'army': {
        need();
        const m = g.military;
        const counts = garrisonCounts(g);
        const lines = [];
        for (const b of g.buildings.values()) {
          if (b.def.kind === 'fort') {
            lines.push(`${b.def.name} #${b.id} at ${b.x},${b.y}: ${counts.get(b.id) || 0}/${FORT_CAPACITY} ${UNIT_TYPES[b.def.unit].name.toLowerCase()}s, ${b.recruiting || 0} on the way, staff ${Math.round(b.efficiency * 100)}%${b.rally ? `, deployed to ${Math.floor(b.rally.x)},${Math.floor(b.rally.y)}` : ''}`);
          } else if (b.def.kind === 'barracks') {
            lines.push(`${b.def.name} #${b.id}: ${Object.entries(b.stock).map(([k, v]) => `${k} ${v}`).join(', ')}, training ${Math.round(b.trainProgress || 0)}%${b.blocked ? ` (${b.blocked})` : ''}`);
          } else if (b.def.kind === 'station') {
            lines.push(`${b.def.name} #${b.id} at ${b.x},${b.y}: ${squadronCounts(g).get(b.id) || 0}/${STATION_CAPACITY} liburnians, staff ${Math.round(b.efficiency * 100)}%${b.rally ? `, deployed to ${Math.floor(b.rally.x)},${Math.floor(b.rally.y)}` : ''}`);
          } else if (b.def.kind === 'navalia') {
            lines.push(`${b.def.name} #${b.id}: ${Object.entries(b.stock).map(([k, v]) => `${k} ${v}`).join(', ')}, building ${Math.round(b.progress || 0)}%, ${b.built || 0} launched${b.blocked ? ` (${b.blocked})` : ''}`);
          }
        }
        for (const u of g.units.values()) {
          if (UNIT_TYPES[u.type].naval) lines.push(`${UNIT_TYPES[u.type].name} #${u.id} at ${Math.floor(u.x)},${Math.floor(u.y)}: ${shipStatus(g, u)}, hull ${Math.ceil(u.hp)}/${u.maxHp}`);
        }
        if (!lines.length) lines.push('No forts or barracks.');
        lines.push(`Raiders on the map: ${enemyCount(g)}. ${threatSummary(g).text}`);
        lines.push(m.settings ? `Next raid: month ${m.nextRaidMonth} (now ${g.time.totalMonths}); sea raids ${m.seaRaids ? 'on' : 'off'}${g.map.seaEntry ? '' : ' (no water from the sea here)'}.` : 'Raids are off in this game.');
        lines.push(`Record: ${m.stats.raids} raids (${m.stats.seaRaids || 0} by sea), ${m.stats.repelled} repelled, ${m.stats.enemiesKilled} raiders slain, ${m.stats.soldiersLost} soldiers lost, ${m.stats.prefectsLost || 0} prefects lost, ${m.stats.trained} trained; ${m.stats.shipsBuilt || 0} liburnians built, ${m.stats.shipsLost || 0} lost, ${m.stats.shipsSunk || 0} raider ships sunk, ${m.stats.boatsSunk || 0} fishing boats lost.`);
        return lines.join('\n');
      }
      case 'win':
        need();
        g.city.flags.consoleWin = true; // not won by play: the Hall of Fame leaves it out (sim/fame.js)
        g.city.victory = true;
        g.events.emit('victory', { scenario: g.scenario.id });
        return 'Victory triggered.';
      case 'stats': {
        need();
        const c = g.city;
        return [
          `Date ${g.time.label()}  pop ${c.population}  treasury ${Math.round(c.treasury)}`,
          `workforce ${c.workforce} jobs ${c.jobs} employed ${c.employed} unemployment ${(c.unemploymentRate * 100).toFixed(1)}%`,
          `sentiment ${c.sentiment} fed ${(c.fedShare * 100).toFixed(0)}% buildings ${g.buildings.size} walkers ${g.walkers.size}`,
          `ratings C${Math.floor(c.ratings.culture)} P${Math.floor(c.ratings.prosperity)} Pe${Math.floor(c.ratings.peace)} F${Math.floor(c.ratings.favor)}`,
          `tiers ${c.tierCounts.join(',')}`,
        ].join('\n');
      }
      case 'goto': {
        need();
        const x = Number(args[0]);
        const y = Number(args[1]);
        if (!g.map.inBounds(x, y)) throw new Error('usage: goto <x> <y> (inside the map)');
        app.renderer.camera.centerOnTile(x, y);
        return `Centered on ${x},${y}`;
      }
      case 'view': {
        need();
        const r = app.renderer;
        if (args[0] === undefined) return `View turn ${r.viewTurn} (0 unturned; Q turns the city clockwise)`;
        const t = Number(args[0]);
        if (!(t >= 0 && t <= 3 && Number.isInteger(t))) throw new Error('usage: view <0-3>');
        app.turnView(t - r.viewTurn);
        return `View turn ${r.viewTurn}`;
      }
      case 'weather': {
        const kind = (args[0] || '').toLowerCase();
        if (!WEATHER[kind]) return `Weather now: ${app.renderer.weather.kind}. Options: ${Object.keys(WEATHER).join(', ')}`;
        if (!app.renderer.weatherOn) return 'Weather is switched off in Settings.';
        const season = app.renderer.pal.season; // the season the weather follows
        const fits = seasonalKind(kind, season);
        app.renderer.weather.force(fits);
        if (fits !== kind) {
          return app.renderer.seasonsOn
            ? `Weather: ${WEATHER[fits].label} (${WEATHER[kind].label.toLowerCase()} is not possible in ${SEASON_NAMES[season].toLowerCase()}).`
            : `Weather: ${WEATHER[fits].label} (Seasons are off in Settings, so the weather stays summer's: no snow).`;
        }
        return `Weather: ${WEATHER[kind].label} (it builds up over a few seconds of game time).`;
      }
      case 'snow': {
        const r = app.renderer;
        const w = r.weather;
        const lvl = Number(args[0]);
        if (args[0] === undefined || !Number.isInteger(lvl) || lvl < 0 || lvl > SNOW_LEVELS) return `Snow cover now: level ${w.coverLevel} (${Math.round(w.cover * 100)}%). Usage: snow <0-${SNOW_LEVELS}>`;
        if (!r.weatherOn || !r.seasonsOn) return 'Snow cover needs both Weather and Seasons switched on in Settings.';
        w.cover = [0, 0.28, 0.62, 0.95][lvl]; // inside each level's band
        w.coverLevel = lvl;
        return lvl ? `Snow cover: level ${lvl}. It melts again unless it keeps snowing (slowly in winter, fast in spring).` : 'Snow cover cleared.';
      }
      case 'sky': {
        const r = app.renderer;
        if (args[0] === 'off' || args[0] === undefined) {
          r.fixedTime = null;
          return g ? `Time of day runs again (now ${dayTime(g.time.totalTicks).toFixed(2)}).` : 'Time of day runs again.';
        }
        const t = Number(args[0]);
        if (!(t >= 0 && t <= 1)) throw new Error('usage: sky <0-1> | off');
        r.fixedTime = t;
        return `Time of day frozen at ${t} (sky off to release).`;
      }
      case 'ground': {
        // The WebGL renderer's ground, for comparing the 3D ground with the sprites while it is in beta.
        const be = app.renderer.backend;
        if (be.kind !== 'webgl') return 'The ground is 3D only with the WebGL renderer (Settings > Renderer, or ?renderer=3d).';
        const mode = (args[0] || '').toLowerCase();
        if (!mode) return `Ground: ${app.renderer.stats.ground || be.groundMode} (ground auto | high | low | off)`;
        if (!['auto', 'high', 'low', 'off'].includes(mode)) throw new Error('usage: ground auto | high | low | off');
        app.flags.ground = mode;
        app.applyGround();
        return `Ground: ${be.groundMode}${mode === 'auto' ? ' (auto)' : ''}. Settings > Ground keeps the choice for next time.`;
      }
      case 'scale': {
        // The WebGL renderer's render scale (render3d/renderScale.js), as Settings > Render scale.
        const be = app.renderer.backend;
        if (be.kind !== 'webgl') return 'The render scale is the WebGL renderer\'s (Settings > Renderer, or ?renderer=3d).';
        const v = (args[0] || '').toLowerCase();
        const now = () => `Render scale: ${be.auto ? 'Auto' : `${Math.round(be.sceneScale * 100)}%`}, the 3D scene at ${Math.round(be.sceneScale * 100)}% and its ground at ${Math.round(be.groundShare * 100)}% of the device pixels (${be.sceneSize || '-'}).`;
        if (!v) return now();
        if (!['auto', '1', '0.75', '0.5'].includes(v)) throw new Error('usage: scale auto | 1 | 0.75 | 0.5');
        app.flags.scale = v;
        app.applyRenderScale();
        return `${now()} Settings > Render scale keeps the choice for next time.`;
      }
      case 'perf': {
        // The performance readout (render/perf.js); on or off shows it in its corner, as F3 does.
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'on' || sub === 'off') app.debugHud = sub === 'on';
        else if (sub) throw new Error('usage: perf [on|off]');
        return app.perfReport().join('\n');
      }
      case 'models': {
        const be = app.renderer.backend;
        if (be.kind !== 'webgl') return 'Models: only the WebGL renderer draws 3D models (Settings > Renderer).';
        const m = be.models;
        const kits = [...m.kits.values()].map((k) => `${k.id} x${k.meshes.reduce((n, im) => Math.max(n, im.count), 0)}`);
        return `Models: ${m.status()}; ${kits.length} looks built${kits.length ? `: ${kits.join(', ')}` : ''}; drawn this frame ${app.renderer.stats.models || 0}.`;
      }
      case 'flora': {
        const be = app.renderer.backend;
        if (be.kind !== 'webgl') return 'Flora: only the WebGL renderer draws 3D trees and rocks (Settings > Renderer).';
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'on' || sub === 'off') be.flora.enabled = sub === 'on';
        else if (sub) throw new Error('usage: flora [on|off]');
        const f = be.flora.stats;
        const state = !be.flora.enabled ? 'off (the sprites)' : f.ready ? 'drawn' : be.drawsGround ? 'getting ready' : 'waiting for the 3D ground (ground high or low)';
        return `Flora: ${state}; ${f.trees} trees and ${f.rocks} rocks on the map, ${f.drawn} in view at detail ${f.lod}${f.impostors ? ' (impostors)' : ''}, ${Math.round(f.triangles / 1000)}k triangles; ${f.kits} looks built, ${f.geometryMB} MB of geometry, ${f.atlasMB} MB of impostors.`;
      }
      case 'textures': {
        // The procedural 3D textures, painted on the GPU: whether the ground's are in, and what painting cost.
        const be = app.renderer.backend;
        const gp = be.groundPass;
        if (!gp) return 'Textures: no 3D ground (the WebGL renderer with ground high or low paints them).';
        const s = painterFor(be.gl).stats;
        const ground = gp.texturesReady ? `ground ${GROUND_LAYERS.length}/${GROUND_LAYERS.length} layers in, ${Math.round(gp.loadMs)} ms after the ground started` : 'ground layers painting';
        // (The models' surfaces, render3d/materials.js, are painted by the same painter.)
        return `Textures: ${ground}; ${s.textures} painted on the GPU (${GROUND_LAYERS.length} ground layers, ${s.textures - GROUND_LAYERS.length} for the models) by ${s.programs} programs `
          + `(compiled in ${Math.round(s.compileMs)} ms, the page busy ${s.submitMs.toFixed(1)} ms sending them).`;
      }
      case 'music': {
        const mu = app.music;
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'on' || sub === 'off') {
          app.settings.music = sub === 'on';
          app.applySettings();
          return mu.describe();
        }
        if (sub === 'next') { mu.skip(); return 'Starting a new piece.'; }
        if (sub === 'tracks') return TRACKS.map((t, k) => `${String(k + 1).padStart(2)}. ${t.title.padEnd(13)} ${t.moods.join(', ')}`).join('\n');
        if (sub === 'play') {
          const name = args.slice(1).join(' ');
          const byNumber = TRACKS[Number(name) - 1];
          const t = mu.play(byNumber ? byNumber.id : name);
          if (!t) throw new Error('usage: music play <track name or number> (music tracks lists them)');
          return `Playing ${t.title}.`;
        }
        if (sub === 'mood') {
          const m = (args[1] || '').toLowerCase();
          if (m !== 'auto' && !MOODS[m]) throw new Error(`usage: music mood ${Object.keys(MOODS).join('|')}|auto`);
          mu.force(m);
          return m === 'auto' ? 'The music follows the game again.' : `Music mood forced to ${m} (music mood auto to release).`;
        }
        if (sub === 'check') {
          app.musicSelfCheck().then((r) => this.print(Object.entries(r).map(([k, v]) => `${k.padEnd(9)} peak ${v.peak.toFixed(2)}  ${v.rmsDb} dBFS${v.bad ? '  BROKEN' : ''}`).join('\n'))).catch((err) => this.print(`Error: ${err.message}`));
          return 'Rendering every mood...';
        }
        if (sub === 'wav') {
          const mood = MOODS[args[1]] ? args[1] : 'day';
          const secs = Math.max(5, Math.min(300, Number(args[2]) || Number(args[1]) || 60));
          app.exportMusic(mood, secs).then((msg) => this.print(msg)).catch((err) => this.print(`Error: ${err.message}`));
          return `Rendering ${secs} s of ${mood} music...`;
        }
        return mu.describe();
      }
      case 'loglevel':
        log.setLevel(args[0]);
        return `Log level ${args[0]}`;
      default:
        throw new Error(`Unknown command "${cmd}". Type help.`);
    }
  }
}

/** The occupied home under the mouse pointer, or null. */
function homeAtCursor(app, g) {
  const t = app.input && app.input.hover;
  if (!t || !g.map.inBounds(t.x, t.y)) return null;
  const b = g.buildings.get(g.map.buildingAt(t.x, t.y));
  return b && b.house && b.house.pop > 0 ? b : null;
}

/** The occupied home with the lowest mood (the oldest on a tie), or null. */
function unhappiestHome(g) {
  let best = null;
  for (const b of g.buildings.values()) {
    const h = b.house;
    if (!h || h.pop <= 0) continue;
    const m = h.mood ?? g.city.sentiment;
    if (!best || m < (best.house.mood ?? g.city.sentiment)) best = b;
  }
  return best;
}

/**
 * The home the `sick` command means: `#id` or `id`, or `x y`, else the one
 * under the cursor, else the occupied home with the highest disease risk.
 */
function pickHome(app, g, args) {
  const occupied = (b) => (b && b.house && b.house.pop > 0 ? b : null);
  if (args.length >= 2) {
    const x = Number(args[0]);
    const y = Number(args[1]);
    if (!g.map.inBounds(x, y)) throw new Error('usage: sick [id | x y]');
    return occupied(g.buildings.get(g.map.buildingAt(x, y)));
  }
  if (args.length === 1) return occupied(g.buildings.get(Number(String(args[0]).replace('#', ''))));
  const here = homeAtCursor(app, g);
  if (here) return here;
  let best = null;
  for (const b of g.buildings.values()) {
    if (!occupied(b) || b.house.sick > 0) continue;
    if (!best || (b.house.diseaseRisk || 0) > (best.house.diseaseRisk || 0)) best = b;
  }
  return best;
}

/** The `event` command's kinds, and what each needs to happen. */
const EVENT_KINDS = 'wageup|wagedown|land|sea|water|mine|clay|quake [size]|emperor';
const EVENT_NEEDS = {
  wageUp: 'Rome already pays the most it will', wageDown: 'Rome already pays the least it will',
  land: 'no open land route', sea: 'no open sea route with a staffed Emporium', water: 'fewer than 200 people, or no disease here',
  mine: 'no iron mine', clay: 'no clay pit',
};

/** The `event` command's report: Rome's wage, trade stopped, a quake, what came so far. */
function eventReport(g) {
  const ev = g.city.events;
  const counts = Object.entries(ev.counts).map(([k, n]) => `${k} ${n}`).join(', ');
  return [
    `Rome pays ${g.city.romeWage} Dn (you pay ${g.city.wage}).`,
    tradeHaltText(g, 'land') || 'Caravans travel freely.',
    tradeHaltText(g, 'sea') || 'Ships sail freely.',
    quakeSummary(g) || 'No earthquake.',
    `So far: ${counts || 'nothing'}.`,
    `Usage: event [${EVENT_KINDS}]`,
  ].join('\n');
}

/** The `health` command's report. */
function healthReport(g) {
  const c = g.city;
  const hc = c.health;
  const y = hc.year;
  const sick = sickHomes(g);
  const on = diseaseEnabled(g)
    ? `Disease is on (${g.difficulty.name}: x${g.difficulty.disease ?? 1}); none below ${CONFIG.DISEASE_MIN_POP} people (now ${c.population}).`
    : 'There is no disease in this mission.';
  return [
    on,
    `City health ${hc.value} (the homes' average ${hc.target}; it moves ${CONFIG.HEALTH_STEP} a month).`,
    `This year: ${y.outbreaks} outbreaks (${y.spread} caught from a neighbor), ${y.deaths} died, ${y.cured} cured by physicians, ${y.recovered} recovered.`,
    `Sick now: ${sick.length ? sick.map((b) => `#${b.id} at ${b.x},${b.y} (${b.house.sick} days)`).join(', ') : 'none'}.`,
    'Closest to an outbreak:',
    ...riskiestHomes(g).map((l) => `  ${l}`),
  ].join('\n');
}

/** The `crime` command's report. */
function crimeReport(g) {
  const c = g.city;
  const y = c.crime.year;
  const about = criminalsAbout(g);
  const chance = crimeChance(c.sentiment) * (g.difficulty.crime ?? 1);
  return [
    crimeEnabled(g) ? `Crime is on (${g.difficulty.name}: x${g.difficulty.crime ?? 1}); none below ${CONFIG.CRIME_MIN_POP} people (now ${c.population}).` : 'There is no crime in this mission.',
    `City mood ${c.sentiment}: a ${Math.round(chance * 100)}% daily chance of trouble (half that for homes a prefect patrols).`,
    `This year: ${y.protesters} protesters, ${y.thieves} thieves, ${y.thefts} thefts (${y.stolen} Dn, ${y.looted} goods), ${y.riots} riots, ${y.riotBurned} buildings burned by rioters, ${y.caught} criminals caught.`,
    `About now: ${about.protester} protesters, ${about.thief} thieves, ${about.rioter} rioters.`,
    'Unhappiest homes:',
    ...unhappiestHomes(g).map((l) => `  ${l}`),
  ].join('\n');
}

/** Average position of the city's homes (where demo extras get built). */
function cityCenter(g) {
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (const b of g.buildings.values()) if (b.house) { sx += b.x; sy += b.y; n++; }
  return n ? { x: Math.round(sx / n), y: Math.round(sy / n) } : null;
}
