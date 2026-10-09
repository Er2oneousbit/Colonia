#!/usr/bin/env node
/**
 * smoke.mjs - end-to-end smoke test of the BUILT game (dist/colonia.html).
 * ----------------------------------------------------------------------------
 * Drives headless Chromium like a player: main menu, sandbox start, building
 * with real mouse drags and keyboard shortcuts, advisors/help/menus, quick
 * save + reload + quick load, and a phone-sized layout check.
 *
 * Usage:  npm run build && npm run test:e2e
 *         node tests/e2e/smoke.mjs [--file dist/colonia.html] [--shots dir] [--help]
 * Needs Playwright (npm i -D playwright, or a global install).
 * Exit code 0 = all checks passed.
 * ----------------------------------------------------------------------------
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { GROUND_LAYERS } from '../../src/render3d/ground/groundSurfaces.js';
import { SURFACES } from '../../src/render3d/surfaces.js';

/** How many textures the GPU paints: the ground's layers, and the look's surfaces with them in the lab. */
const N_GROUND = GROUND_LAYERS.length;
const N_TEXTURES = N_GROUND + Object.keys(SURFACES).length;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node tests/e2e/smoke.mjs [--file dist/colonia.html] [--shots dir]');
  process.exit(0);
}
const file = path.resolve(args.includes('--file') ? args[args.indexOf('--file') + 1] : path.join(ROOT, 'dist/colonia.html'));
const shots = args.includes('--shots') ? path.resolve(args[args.indexOf('--shots') + 1]) : null;
if (!fs.existsSync(file)) {
  console.error(`Missing ${file}. Run "npm run build" first.`);
  process.exit(2);
}
if (shots) fs.mkdirSync(shots, { recursive: true });

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const t of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(t); } catch { /* next */ }
  }
  console.error('Playwright not found. Install it with: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const { chromium } = loadPlaywright();
const url = pathToFileURL(file).href;
const results = [];
// On GitHub Actions a failure is also written as an annotation (public on
// the run's page and through the API, unlike the log), so it names itself.
const inCI = !!process.env.GITHUB_ACTIONS;
const annotate = (title, text) => { if (inCI) console.log(`::error title=${title}::${String(text).replace(/\s+/g, ' ').slice(0, 900)}`); };
const lastCheck = () => (results.length ? results[results.length - 1].name : 'start');
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) annotate('Smoke check failed', `${name}${detail ? ` (${detail})` : ''}`);
};
// A step that throws (a timeout, a missing element) ends the run: say where.
for (const ev of ['uncaughtException', 'unhandledRejection']) {
  process.on(ev, (err) => {
    annotate('Smoke test crashed', `${err && err.message} (after "${lastCheck()}")`);
    console.error(err);
    process.exit(1);
  });
}
// Network failures for optional web fonts are not game errors.
const ignorable = (t) => /fonts\.(googleapis|gstatic)|ERR_CERT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|Failed to load resource/i.test(t);

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });

  // 1. Main menu
  await page.goto(url);
  await page.waitForSelector('.menu-card', { timeout: 15000 });
  check('main menu shows', await page.isVisible('text=Campaign'));
  // 1a. Browsers hold sound back until the first gesture: the menu waits
  //     behind the title gate, and clicking it starts the menu music (and
  //     does not press the menu button underneath).
  const gated = await page.evaluate(() => ({ gate: !!document.getElementById('title-gate'), inert: !!document.getElementById('main-menu').inert, playing: window.colonia.music.playing }));
  check('title gate covers the menu until the first click', gated.gate && gated.inert && !gated.playing, JSON.stringify(gated));
  if (shots) await page.screenshot({ path: path.join(shots, 'smoke-gate.png') });
  await page.click('#title-gate');
  await page.waitForFunction(() => window.colonia.music.barsPlayed > 0, null, { timeout: 5000 }).catch(() => {});
  const menuMusic = await page.evaluate(() => { const m = window.colonia.music; return { playing: m.playing, mood: m.mood, bars: m.barsPlayed, gate: !!document.querySelector('#title-gate:not(.leaving)'), modal: !!document.querySelector('.modal') }; });
  check('clicking the title gate starts the menu music', menuMusic.playing && menuMusic.mood === 'menu' && menuMusic.bars > 0 && !menuMusic.gate && !menuMusic.modal, JSON.stringify(menuMusic));
  // The menu really shows afterwards (isVisible ignores opacity and inert).
  await page.waitForTimeout(450);
  const shown = await page.evaluate(() => ({ opacity: getComputedStyle(document.querySelector('#main-menu .menu-card')).opacity, inert: !!document.getElementById('main-menu').inert }));
  check('the menu card fades in and takes input after the gate', shown.opacity === '1' && !shown.inert, JSON.stringify(shown));
  // 1a (cont.) The menu's backdrop tours its town and never shows the dark
  // beyond the map: ten minutes of drift, every corner of the screen on land.
  const tour = await page.evaluate(() => {
    const app = window.colonia;
    if (!app.menuOrbit) return null;
    const cam = app.renderer.camera;
    const map = app.menuGame.map;
    const vw = cam.viewW / cam.dpr;
    const vh = cam.viewH / cam.dpr;
    const c0 = { x: app.menuOrbit.fit.x, y: app.menuOrbit.fit.y };
    let far = 0;
    let off = 0;
    for (let k = 0; k < 600; k++) {
      app.menuDrift(1);
      const c = cam.center();
      far = Math.max(far, Math.hypot(c.x - c0.x, c.y - c0.y));
      for (const [sx, sy] of [[0, 0], [vw - 1, 0], [0, vh - 1], [vw - 1, vh - 1]]) {
        const t = cam.screenToTile(sx, sy);
        if (t.x < 0 || t.y < 0 || t.x >= map.w || t.y >= map.h) off++;
      }
    }
    return { far: Math.round(far), off, swing: app.menuOrbit.fit.scale, zoom: cam.zoomIndex };
  });
  // The menu's map is random: on some the town sits so near the edge that the
  // tour holds still rather than show the dark (swing 0). Otherwise it moves.
  check('the menu backdrop tours its town and never shows the dark beyond the map', !!tour && tour.off === 0 && tour.far <= 400 && (tour.swing > 0 ? tour.far > 50 : tour.far === 0), JSON.stringify(tour));
  // 1b. The rest of the gesture never presses a menu button: the second click
  //     of a double-click on the gate, or a held Enter key (auto-repeat).
  {
    const p2 = await ctx.newPage();
    await p2.goto(url);
    await p2.waitForSelector('#title-gate', { timeout: 15000 });
    const at = await p2.evaluate(() => { const r = [...document.querySelectorAll('#main-menu .btn')].find((b) => /Sandbox/.test(b.textContent)).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p2.mouse.move(at.x, at.y);
    await p2.mouse.down(); await p2.mouse.up();
    await p2.waitForTimeout(300);
    await p2.mouse.down({ clickCount: 2 }); await p2.mouse.up({ clickCount: 2 });
    await p2.waitForTimeout(400);
    check('double-click on the title gate presses no menu button', !(await p2.$('.modal')));
    await p2.goto(url);
    await p2.waitForSelector('#title-gate', { timeout: 15000 });
    await p2.keyboard.down('Enter');
    await p2.waitForTimeout(500);
    for (let i = 0; i < 4; i++) { await p2.keyboard.down('Enter'); await p2.waitForTimeout(40); } // auto-repeats
    await p2.keyboard.up('Enter');
    await p2.waitForTimeout(400);
    const held = !(await p2.$('.modal'));
    await p2.keyboard.press('Enter');
    await p2.waitForTimeout(300);
    const opened = await p2.evaluate(() => { const m = document.querySelector('.modal'); return m ? m.textContent.slice(0, 40) : ''; });
    check('holding Enter on the title gate presses no menu button, then Enter opens the first one', held && /Campaign/.test(opened), JSON.stringify({ held, opened }));
    // A quick tap of Enter (the usual press) leaves the keyboard on the menu.
    await p2.goto(url);
    await p2.waitForSelector('#title-gate', { timeout: 15000 });
    await p2.keyboard.press('Enter');
    await p2.waitForTimeout(600);
    const focused = await p2.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent, modal: !!document.querySelector('.modal') }));
    check('a quick Enter on the title gate puts keyboard focus on the first menu button', focused.tag === 'BUTTON' && /Campaign/.test(focused.text) && !focused.modal, JSON.stringify(focused));
    await p2.close();
  }
  if (shots) await page.screenshot({ path: path.join(shots, 'smoke-menu.png') });

  // 2. Start a sandbox from the menu UI (after a look at the Uber size and Insane difficulty)
  await page.click('text=Sandbox');
  const sizeSel = 'select:has(option[value="uber"])';
  const uberLabel = await page.$eval(`${sizeSel} option[value="uber"]`, (o) => o.textContent);
  await page.selectOption(sizeSel, 'uber');
  const uberNote = await page.isVisible('text=Sixteen times the land of Small');
  await page.selectOption(sizeSel, 'medium');
  check('sandbox menu offers the Uber map with a note', uberLabel === 'Uber (256×256)' && uberNote, uberLabel);
  await page.selectOption('select.difficulty-select', 'insane');
  const insaneNote = await page.isVisible('text=For veterans.');
  await page.selectOption('select.difficulty-select', 'normal');
  check('sandbox menu offers Insane and describes each level', insaneNote && await page.isVisible('text=The game as designed.'));
  // The province's place on the empire map: six choices, the Etruscan coast first and picked.
  const sites = await page.$$eval('select.site-select option', (os) => os.map((o) => [o.value, o.selected]));
  check('sandbox menu offers six places for the province, the Etruscan coast by default', sites.length === 6 && sites[0][0] === 'etruria' && sites[0][1] && sites.filter((s) => s[1]).length === 1, JSON.stringify(sites));
  // The events (sim/events.js): a master switch over one switch per event, all ticked.
  const evState = () => page.evaluate(() => {
    const master = document.querySelector('input.events-switch');
    const boxes = [...document.querySelectorAll('input.event-switch')];
    return { master: master.checked, half: master.indeterminate, n: boxes.length, on: boxes.filter((b) => b.checked).map((b) => b.dataset.event) };
  });
  const ev0 = await evState();
  check('sandbox menu has an Events switch over one switch per event, all ticked', ev0.master && !ev0.half && ev0.n === 6 && ev0.on.length === 6, JSON.stringify(ev0));
  await page.uncheck('input.events-switch');
  const ev1 = await evState();
  await page.check('input.events-switch');
  const ev2 = await evState();
  check('the Events switch clears every event, then ticks them all again', !ev1.master && !ev1.half && ev1.on.length === 0 && ev2.master && ev2.on.length === 6, JSON.stringify([ev1, ev2]));
  // One event unticked: the master shows a mix, and the city founded below has it off.
  await page.uncheck('input.event-switch[data-event="mine"]');
  const ev3 = await evState();
  check('unticking one event (the mine collapse) leaves the Events switch half-ticked', ev3.half && !ev3.master && ev3.on.length === 5 && !ev3.on.includes('mine'), JSON.stringify(ev3));
  // Watch the first frames of the new game: its look (a winter month) must
  // replace the menu city's summer look at once, not piece by piece.
  await page.evaluate(() => {
    const r = window.colonia.renderer;
    const orig = r.render;
    window.__look = [];
    r.render = function (a, d) {
      orig.call(this, a, d);
      if (window.colonia.game && window.__look.length < 3) window.__look.push({ prev: this.palPrev, pending: this.stats.pending, key: this.pal.key });
    };
    window.__unhookRender = () => { r.render = orig; };
    // Fullscreen on starting a game (ui/fullscreen.js, on by default): the request is recorded,
    // not made (a headless page that went fullscreen would change size under the checks below).
    window.__fsAsks = [];
    document.documentElement.requestFullscreen = function (opts) { window.__fsAsks.push({ el: this === document.documentElement, active: !!navigator.userActivation?.isActive, opts }); return Promise.resolve(); };
  });
  await page.click('text=Found the city');
  await page.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 15000 });
  check('sandbox starts from the menu', true);
  const fsAsk = await page.evaluate(() => ({ asks: window.__fsAsks, setting: window.colonia.settings.fullscreen, counted: window.colonia.fullscreenAsks }));
  check('Found the city asks for the whole page fullscreen, inside the click (Settings: on by default)', fsAsk.setting === true && fsAsk.asks.length === 1 && fsAsk.asks[0].el && fsAsk.asks[0].active && fsAsk.counted === 1, JSON.stringify(fsAsk));
  // (Off from here on, stored: a game started by Continue or Load after a reload would make this
  // headless page truly fullscreen, at another size, under the checks that follow.)
  await page.evaluate(() => { window.colonia.settings.fullscreen = false; window.colonia.applySettings(); });
  check('the sandbox from the menu is on the Etruscan coast', await page.evaluate(() => window.colonia.game.scenario.site) === 'etruria');
  const founded = await page.evaluate(() => window.colonia.game.scenario.events);
  check('the sandbox from the menu has every event on but the one unticked', JSON.stringify(founded) === JSON.stringify(['wages', 'land', 'sea', 'water', 'clay']), JSON.stringify(founded));
  await page.waitForFunction(() => window.__look.length >= 3, null, { timeout: 5000 }).catch(() => {});
  const look = await page.evaluate(() => { window.__unhookRender(); return window.__look; });
  check('a new game shows its own season from the first frame (no old-look patchwork)', look.length > 0 && look.every((f) => f.prev === null && !f.pending), JSON.stringify(look));
  // A fresh map holds still until the player does something: the cursor rests
  // where the button was (no pointer move, no key), so nothing may scroll.
  const camAt = () => page.evaluate(() => { const cam = window.colonia.renderer.camera; const c = cam.center(); return { x: c.x, y: c.y, moving: cam.moving }; });
  const cam0 = await camAt();
  // The clicks above count as the player's first interaction: music may start.
  await page.waitForTimeout(800);
  const cam1 = await camAt();
  const drift = Math.hypot(cam1.x - cam0.x, cam1.y - cam0.y);
  check('fresh map: the view holds still without input', drift < 1 && !cam1.moving, `moved ${Math.round(drift)} world px`);
  // Edge scrolling still works once the mouse really moves to the edge.
  const edgeY = await page.evaluate(() => { const r = window.colonia.canvas.getBoundingClientRect(); return r.top + r.height / 2; });
  await page.mouse.move(3, edgeY);
  await page.waitForTimeout(300);
  const cam2 = await camAt();
  await page.mouse.move(400, edgeY);
  check('edge scrolling works after a real mouse move', cam2.x < cam1.x - 50, `dx ${Math.round(cam2.x - cam1.x)}`);
  const music = await page.evaluate(() => { const m = window.colonia.music; return { playing: m.playing, mood: m.mood, bars: m.barsPlayed, now: m.nowPlaying }; });
  check('music plays in the day mood once the city is founded', music.playing && music.mood === 'day' && music.bars > 0, JSON.stringify(music));

  // 3. Build with real input: road drag + housing drag near the map entrance
  // The road tile nearest the map's center that has free land beside it
  // (a 6x3 patch 2-11 tiles off it). Only the one nearest tile was tried
  // before, and on a random map where water or forest hemmed it in the
  // check failed for that reason alone: every road tile is tried in turn.
  const found = await page.evaluate(() => {
    const app = window.colonia;
    const g = app.game;
    const m = g.map;
    app.paused = true;
    const roads = [];
    for (let i = 0; i < m.size; i++) if (m.road[i]) roads.push({ x: m.xOf(i), y: m.yOf(i), d: Math.hypot(m.xOf(i) - m.w / 2, m.yOf(i) - m.h / 2) });
    roads.sort((a, b) => a.d - b.d);
    for (const best of roads) {
      for (let r = 2; r < 12; r++) {
        for (const [dx, dy] of [[0, r], [r, 0], [0, -r], [-r, 0]]) {
          let ok = true;
          for (let k = 0; k < 6 && ok; k++) for (let j = 0; j < 3; j++) if (!m.isFree(best.x + dx + k, best.y + dy + j)) { ok = false; break; }
          if (ok) {
            app.renderer.camera.centerOnTile(best.x, best.y);
            return { info: { x: best.x, y: best.y, money: g.city.treasury, buildings: g.buildings.size }, spot: { x: best.x + dx, y: best.y + dy } };
          }
        }
      }
    }
    return { info: { x: roads[0].x, y: roads[0].y, money: g.city.treasury, buildings: g.buildings.size }, spot: null };
  });
  const info = found.info;
  const toScreen = (tx, ty) => page.evaluate(([x, y]) => {
    const cam = window.colonia.renderer.camera;
    const wx = (x + 0.5 - (y + 0.5)) * 32;
    const wy = (x + 0.5 + (y + 0.5)) * 16;
    const r = window.colonia.canvas.getBoundingClientRect();
    return { x: r.left + ((wx - cam.x) * cam.scale) / cam.dpr, y: r.top + ((wy - cam.y) * cam.scale) / cam.dpr };
  }, [tx, ty]);
  const spot = found.spot;
  check('found free land for the input test', !!spot);
  if (spot) {
    await page.keyboard.press('r');
    const a = await toScreen(spot.x, spot.y);
    const b = await toScreen(spot.x + 5, spot.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
    const roadOk = await page.evaluate(({ x, y }) => window.colonia.game.map.road[window.colonia.game.map.idx(x + 3, y)] > 0, spot);
    // On failure, say where the drag went: the tiles under the mouse and the camera state.
    const roadDetail = roadOk ? '' : await page.evaluate(([s, p, q]) => {
      const app = window.colonia; const cam = app.renderer.camera; const m = app.game.map;
      const r = app.canvas.getBoundingClientRect();
      const under = (pt) => { const el = document.elementFromPoint(pt.x, pt.y); return { tile: cam.screenToTile(pt.x - r.left, pt.y - r.top), el: el ? (el.id || el.className) : null }; };
      return JSON.stringify({ spot: s, start: under(p), end: under(q), zoom: cam.zoom, target: cam.targetZoom, moving: cam.moving, tool: app.input.tool, paused: app.paused, modal: !!document.querySelector('.modal'), terrain: [0, 1, 2, 3, 4, 5].map((k) => m.terrain[m.idx(s.x + k, s.y)]) });
    }, [spot, a, b]);
    check('road drag builds a road', roadOk, roadDetail);
    await page.keyboard.press('h');
    const c = await toScreen(spot.x, spot.y + 1);
    const d = await toScreen(spot.x + 5, spot.y + 2);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(d.x, d.y, { steps: 8 });
    await page.mouse.up();
    const after = await page.evaluate(() => ({ money: window.colonia.game.city.treasury, buildings: window.colonia.game.buildings.size }));
    check('housing drag places houses', after.buildings >= info.buildings + 6, `${after.buildings - info.buildings} new`);
    check('construction costs money', after.money < info.money, `${info.money} -> ${after.money}`);
    await page.mouse.click(c.x, c.y, { button: 'right' }); // cancel tool
    check('right click cancels the tool', await page.evaluate(() => window.colonia.input.tool === null));
    await page.mouse.click(c.x, c.y);
    check('clicking a house opens the info panel', await page.isVisible('#info-panel'));
  }

  // 3b. No road, made obvious: a Prefecture placed where no road touches it.
  //     The ghost turns orange with the edge tiles a road would serve picked
  //     out and the warning by the cursor; once built, a red sign floats over
  //     it (counted by the renderer, and red pixels where it says it drew).
  //     Undone afterwards, so the demo city below has its land.
  const lone = await page.evaluate(() => {
    const app = window.colonia;
    const m = app.game.map;
    const c = app.renderer.camera.screenToTile(app.canvas.width / app.renderer.camera.dpr / 2, app.canvas.height / app.renderer.camera.dpr / 2);
    // Two tiles side by side (x and x + 3), each with nothing but open land within 3 tiles.
    const open = (x, y) => {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (!m.isFree(x + dx, y + dy) || m.terrain[m.idx(x + dx, y + dy)] === 2) return false;
      return true;
    };
    for (let r = 0; r < 30; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = Math.round(c.x) + dx; const y = Math.round(c.y) + dy;
        if (open(x, y) && open(x + 3, y)) { app.renderer.camera.centerOnTile(x + 1, y); return { x, y }; }
      }
    }
    return null;
  });
  check('found open land away from roads for the no-road test', !!lone);
  if (lone) {
    await page.evaluate(() => window.colonia.ui.selectTool('prefecture'));
    await page.waitForTimeout(100);
    const lp = await toScreen(lone.x, lone.y);
    await page.mouse.move(lp.x - 6, lp.y);
    await page.mouse.move(lp.x, lp.y);
    await page.waitForTimeout(200);
    const ghost = await page.evaluate(() => {
      const t = document.getElementById('tooltip');
      const st = window.colonia.renderer.stats;
      return { noRoad: st.ghostNoRoad, edges: st.roadEdges, tip: !t.classList.contains('hidden') && t.classList.contains('warn'), text: t.textContent, side: !!document.querySelector('#tool-info .err') };
    });
    check('placing with no road: orange ghost, the 4 edge tiles picked out, the warning by the cursor and in the sidebar', ghost.noRoad && ghost.edges === 4 && ghost.tip && /No road touches it/.test(ghost.text) && ghost.side, JSON.stringify(ghost));
    await page.mouse.click(lp.x, lp.y);
    const lp2 = await toScreen(lone.x + 3, lone.y);
    await page.mouse.move(lp2.x, lp2.y, { steps: 3 }); // the ghost beside it, for the screenshot
    await page.waitForTimeout(200);
    const sign = await page.evaluate(({ x, y }) => {
      const app = window.colonia;
      const b = [...app.game.buildings.values()].find((v) => v.type === 'prefecture' && v.x === x && v.y === y);
      if (!b) return { placed: false };
      const r = app.renderer;
      const spot = r.noRoadSpots.find((s) => s.id === b.id);
      if (!spot) return { placed: true, count: r.stats.noRoad, spot: null };
      // Red pixels in the sign's disc, read back from the canvas.
      const ctx = app.canvas.getContext('2d');
      const n = Math.ceil(spot.r);
      const px = ctx.getImageData(Math.round(spot.x - n), Math.round(spot.y - n), 2 * n, 2 * n).data;
      let red = 0;
      for (let q = 0; q < px.length; q += 4) if (px[q] > 170 && px[q + 1] < 90 && px[q + 2] < 90) red++;
      return { placed: true, count: r.stats.noRoad, spot: true, red, of: px.length / 4 };
    }, lone);
    check('a building with no road gets the red no-road sign over it', sign.placed && sign.count >= 1 && sign.spot && sign.red > sign.of * 0.15, JSON.stringify(sign));
    if (shots) await page.screenshot({ path: path.join(shots, 'smoke-noroad.png') });
    await page.keyboard.press('Escape');
    const gone = await page.evaluate(({ x, y }) => {
      const app = window.colonia;
      app.undo();
      return ![...app.game.buildings.values()].some((v) => v.type === 'prefecture' && v.x === x && v.y === y);
    }, lone);
    check('the lone prefecture is undone again', gone);
    // R turns the building in hand: the ghost turns, the build panel says
    // so, and it is placed turned (then undone again).
    await page.evaluate(() => window.colonia.ui.selectTool('prefecture'));
    await page.mouse.move(lp.x - 6, lp.y);
    await page.mouse.move(lp.x, lp.y);
    await page.waitForTimeout(150);
    const before = await page.evaluate(() => window.colonia.renderer.stats.ghostTurn);
    await page.keyboard.press('r');
    await page.waitForTimeout(200);
    const turned = await page.evaluate(() => ({ ghost: window.colonia.renderer.stats.ghostTurn, button: document.querySelector('#tool-info .turn-btn')?.dataset.turn, tool: window.colonia.input.tool }));
    await page.mouse.click(lp.x, lp.y);
    const placedTurned = await page.evaluate(({ x, y }) => {
      const app = window.colonia;
      const b = [...app.game.buildings.values()].find((v) => v.type === 'prefecture' && v.x === x && v.y === y);
      const turn = b ? b.turn : null;
      app.undo();
      delete app.input.turns.prefecture; // (later steps place prefectures as they always did)
      return turn;
    }, lone);
    await page.keyboard.press('Escape');
    check('R turns the building in hand: the ghost and the Turn button show it, and it is placed turned', before === 0 && turned.ghost === 1 && turned.button === '1' && turned.tool === 'prefecture' && placedTurned === 1, JSON.stringify({ before, turned, placedTurned }));
    // Facing the road by itself: a road tile laid with the mouse beside the
    // lone spot's +x side (the Road tool, R with nothing in hand), then a
    // prefecture held there turns its front (+y at turn 0) to it: turn 3,
    // and the build panel says so. Both undone again.
    await page.keyboard.press('r');
    const rp = await toScreen(lone.x + 1, lone.y);
    await page.mouse.move(rp.x - 6, rp.y);
    await page.mouse.move(rp.x, rp.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.colonia.ui.selectTool('prefecture'));
    await page.mouse.move(lp.x - 6, lp.y);
    await page.mouse.move(lp.x, lp.y);
    await page.waitForTimeout(200);
    const faced = await page.evaluate(({ x, y }) => {
      const app = window.colonia;
      const m = app.game.map;
      return { road: !!m.road[m.idx(x + 1, y)], ghost: app.renderer.stats.ghostTurn, auto: app.renderer.plan?.autoTurned, panel: document.querySelector('#tool-info [data-auto-turn]')?.dataset.autoTurn ?? null };
    }, lone);
    await page.keyboard.press('Escape');
    await page.evaluate(({ x, y }) => { const app = window.colonia; if (app.game.map.road[app.game.map.idx(x + 1, y)]) app.undo(); }, lone);
    check('a building held beside a single road turns its front to it by itself, and the build panel says so', faced.road && faced.ghost === 3 && faced.auto === true && faced.panel === '3', JSON.stringify(faced));
  }

  // 4. Menus and advisors via keyboard
  await page.keyboard.press('F2');
  // (The modal itself: the top bar's "Advisors" label hides when the bar is full.)
  check('F2 opens advisors', await page.evaluate(() => window.colonia.ui.modalKind === 'advisors' && !!document.querySelector('.modal')));
  for (const tab of ['Labor', 'Population', 'Production', 'Finance', 'Trade', 'Military', 'Health', 'Education', 'Entertainment', 'Religion', 'Ratings', 'Imperial']) {
    await page.click(`.tab:has-text("${tab}")`);
  }
  check('advisor tabs render', errors.length === 0, errors.join(' | '));
  await page.keyboard.press('Escape');
  await page.keyboard.press('F1');
  check('F1 opens help', await page.isVisible('text=How to play'));
  await page.keyboard.press('Escape');

  // 5. Let it run with the demo city, then quick save / reload / quick load
  await page.evaluate(() => {
    const app = window.colonia;
    app.ui.console.run('demo 2');
    app.ui.console.run('days 64');
    app.setSpeed(3);
  });
  await page.waitForTimeout(1500);
  if (shots) await page.screenshot({ path: path.join(shots, 'smoke-city.png') });
  const saved = await page.evaluate(() => ({ b: window.colonia.game.buildings.size, pop: window.colonia.game.city.population }));
  check('city grows', saved.pop > 50, `pop ${saved.pop}`);
  await page.evaluate(() => window.colonia.togglePause());

  // 5. (cont.) Turning the view (render/view.js): Q turns the city a quarter
  //    turn clockwise, keeping the middle of the screen where it is; at every
  //    turn a click on a known building opens it; a road dragged at turn 1
  //    is built where it was dragged; the minimap turns with the view and a
  //    click on it still goes to the spot; the top bar's needle follows.
  {
    const pickTarget = () => page.evaluate(() => {
      const app = window.colonia;
      const b = [...app.game.buildings.values()].filter((v) => !v.house && v.size >= 2 && v.def.kind !== 'farm').sort((p, q) => q.size - p.size || p.id - q.id)[0];
      return b ? { id: b.id, x: b.x, y: b.y, S: b.size, type: b.type } : null;
    });
    const target = await pickTarget();
    check('the demo city has a building to click from every side', !!target);
    // Where a map point is on the page, through the view turn.
    const onPage = (fx, fy) => page.evaluate(([x, y]) => {
      const app = window.colonia;
      const cam = app.renderer.camera;
      const w = cam.mapToWorld(x, y);
      const r = app.canvas.getBoundingClientRect();
      return { x: r.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: r.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
    }, [fx, fy]);
    const middleTile = () => page.evaluate(() => {
      const app = window.colonia;
      const cam = app.renderer.camera;
      return cam.screenToTile(cam.viewW / cam.dpr / 2, cam.viewH / cam.dpr / 2);
    });
    if (target) {
      await page.evaluate((t) => { const app = window.colonia; app.ui.info.close(); app.renderer.camera.centerOnTile(t.x + 1, t.y + 1); }, target);
      const mid0 = await middleTile();
      await page.mouse.move(300, 12); // (over the top bar: off the map, and no edge scrolling)
      await page.keyboard.press('q');
      await page.waitForTimeout(150);
      const after = await page.evaluate(() => ({ turn: window.colonia.renderer.camera.turn, needle: document.getElementById('hud-north')?.dataset.turn, north: window.colonia.ui.sidebar.minimap.north }));
      const mid1 = await middleTile();
      check('Q turns the view a quarter turn, the middle of the screen stays, the needle follows', after.turn === 1 && after.needle === '1' && mid1.x === mid0.x && mid1.y === mid0.y, JSON.stringify({ after, mid0, mid1 }));
      await page.keyboard.press('Shift+Q');
      await page.waitForTimeout(100);
      check('Shift+Q turns it back', await page.evaluate(() => window.colonia.renderer.camera.turn) === 0);
      const opened = [];
      const norths = [];
      for (let t = 0; t < 4; t++) {
        await page.evaluate((v) => { const app = window.colonia; app.ui.info.close(); app.renderer.camera.centerOnTile(v.x + 1, v.y + 1); }, target);
        await page.waitForTimeout(120);
        const p = await onPage(target.x + target.S / 2, target.y + target.S / 2);
        await page.mouse.click(p.x, p.y);
        await page.waitForTimeout(120);
        opened.push(await page.evaluate(() => ({ turn: window.colonia.renderer.camera.turn, target: window.colonia.ui.info.target })));
        norths.push(await page.evaluate(() => window.colonia.ui.sidebar.minimap.north));
        if (shots) await page.screenshot({ path: path.join(shots, `smoke-view-${t}.png`) });
        await page.evaluate(() => window.colonia.ui.info.close());
        await page.click('#hud-turn-right');
      }
      check('at every turn a click on a building opens its panel', opened.every((o, t) => o.turn === t && o.target?.kind === 'building' && o.target.id === target.id), JSON.stringify(opened));
      check('the turn button turns the view, four times round again', await page.evaluate(() => window.colonia.renderer.camera.turn) === 0);
      check('the minimap turns with the view: its north mark goes round', new Set(norths.map((n) => n && `${Math.round(n.x)},${Math.round(n.y)}`)).size === 4, JSON.stringify(norths));
      // The minimap at turn 1: a click on the spot where the building shows takes the view there.
      await page.keyboard.press('q');
      await page.evaluate(() => { const app = window.colonia; const m = app.game.map; app.renderer.camera.centerOnTile(m.w >> 1, m.h >> 1); });
      const mm = await page.evaluate((v) => {
        const app = window.colonia;
        const mmap = app.ui.sidebar.minimap;
        const cv = mmap.canvas;
        const { scale, ox, oy, h } = mmap.layout;
        const w = app.renderer.camera.mapToWorld(v.x + v.S / 2, v.y + v.S / 2);
        const px = ox + (w.x / 32 + h - 1) * scale;
        const py = oy + (w.y / 32) * scale;
        const r = cv.getBoundingClientRect();
        return { x: r.left + (px / cv.width) * r.width, y: r.top + (py / cv.height) * r.height, shown: r.width > 0 };
      }, target);
      if (mm.shown) {
        await page.mouse.click(mm.x, mm.y);
        await page.waitForTimeout(1200);
        const at = await middleTile();
        check('at turn 1 a click on the minimap goes to that spot', Math.abs(at.x - target.x - 1) <= 2 && Math.abs(at.y - target.y - 1) <= 2, JSON.stringify({ at, target }));
      }
      // A road dragged at turn 1 goes where it was dragged.
      const free = await page.evaluate(() => {
        const app = window.colonia;
        const m = app.game.map;
        const c = app.renderer.camera.screenToTile(app.canvas.width / app.renderer.camera.dpr / 2, app.canvas.height / app.renderer.camera.dpr / 2);
        for (let r = 0; r < 40; r++) {
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            const x = c.x + dx; const y = c.y + dy;
            let ok = true;
            for (let k = -1; k < 7 && ok; k++) for (let j = -1; j <= 1; j++) if (!m.isFree(x + k, y + j)) { ok = false; break; }
            if (ok) { app.renderer.camera.centerOnTile(x + 3, y); return { x, y }; }
          }
        }
        return null;
      });
      check('found free land for a road at turn 1', !!free);
      if (free) {
        await page.waitForTimeout(100);
        await page.keyboard.press('r'); // the Road tool
        const a = await onPage(free.x + 0.5, free.y + 0.5);
        const b = await onPage(free.x + 5.5, free.y + 0.5);
        await page.mouse.move(a.x, a.y);
        await page.mouse.down();
        await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
        await page.mouse.move(b.x, b.y, { steps: 5 });
        await page.mouse.up();
        const road = await page.evaluate((f) => {
          const app = window.colonia;
          const m = app.game.map;
          const laid = [0, 1, 2, 3, 4, 5].map((k) => m.road[m.idx(f.x + k, f.y)] > 0);
          const turn = app.renderer.camera.turn;
          app.undo();
          app.ui.selectTool(null);
          return { laid, turn };
        }, free);
        check('at turn 1 a road dragged along the map is built where it was dragged', road.turn === 1 && road.laid.every(Boolean), JSON.stringify(road));
      }
      await page.evaluate(() => window.colonia.turnView(-window.colonia.renderer.viewTurn));
    }
  }

  // 5. (cont.) The housing ladder: a home shown at every level (1-20) gets its info
  //     panel with the level's name, and the Population advisor lists them all.
  const ladder = await page.evaluate(() => {
    const app = window.colonia;
    const home = [...app.game.buildings.values()].find((b) => b.house && b.house.pop > 0 && b.size === 1);
    if (!home) return { ok: false };
    const was = home.house.tier;
    const heads = [];
    for (let t = 1; t <= 20; t++) {
      home.house.tier = t;
      app.ui.info.showBuilding(home.id);
      heads.push(document.querySelector('#info-panel h3')?.textContent || '');
    }
    home.house.tier = was;
    app.ui.info.close();
    return { ok: true, heads };
  });
  check('the info panel names all 20 housing levels', ladder.ok && ladder.heads.length === 20 && ladder.heads[0] === 'Tent' && ladder.heads[19] === 'Imperial Palatium' && new Set(ladder.heads).size === 20 && errors.length === 0, JSON.stringify(ladder.heads));
  // 5. (cont.) Storage orders: a granary's or warehouse's panel has a button
  //     per good that cycles Accept, Refuse, Get, and an Empty switch
  //     (sim/storageOrders.js). This map's demo city has a granary but no
  //     warehouse; the phone check below uses a warehouse.
  const store = await page.evaluate(() => {
    const app = window.colonia;
    const all = [...app.game.buildings.values()];
    const b = all.find((x) => x.type === 'warehouse') || all.find((x) => x.type === 'granary');
    if (!b) return null;
    app.ui.info.showBuilding(b.id);
    return { id: b.id, good: b.type === 'warehouse' ? 'wine' : 'wheat', name: b.type };
  });
  check('demo city has a granary or warehouse', !!store);
  if (store) {
    const order = () => page.evaluate(({ id, good }) => window.colonia.game.buildings.get(id).orders[good], store);
    const seen = [await order()];
    for (let k = 0; k < 3; k++) {
      await page.click(`#info-panel .order-btn[data-good="${store.good}"]`);
      seen.push(await order());
    }
    // A slow press: the panel's timed rebuild (every 0.7 s) must wait for the
    // release, or the button is replaced under the pointer and the click lost.
    // The panel rebuilds every 0.7 s; a read that lands on a rebuild finds no
    // button (it failed once that way): read again until one is there.
    let box = null;
    for (let k = 0; k < 10 && !box; k++) {
      box = await page.locator(`#info-panel .order-btn[data-good="${store.good}"]`).boundingBox().catch(() => null);
      if (!box) await page.waitForTimeout(100);
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    const slow = await order();
    for (let k = 0; k < 2; k++) await page.click(`#info-panel .order-btn[data-good="${store.good}"]`); // back to Accept
    check('a slow press on an order button is not lost to the panel refreshing', slow === 'refuse' && (await order()) === 'accept', `after the slow press: ${slow}`);
    const label = await page.textContent(`#info-panel .order-btn[data-good="${store.good}"]`);
    await page.click(`#info-panel button:has-text("Empty the ${store.name}")`);
    const emptying = await page.evaluate(({ id }) => window.colonia.game.buildings.get(id).emptying, store);
    const says = await page.textContent('#info-panel');
    await page.click('#info-panel button:has-text("Stop emptying")');
    const stopped = await page.evaluate(({ id }) => !window.colonia.game.buildings.get(id).emptying, store);
    await page.evaluate(() => window.colonia.ui.info.close());
    check(`a ${store.name}'s order cycles Accept, Refuse, Get in its panel, and Empty switches on and off`,
      seen.join() === 'accept,refuse,get,accept' && label === 'Accept' && emptying && /Emptying/.test(says) && stopped && errors.length === 0,
      JSON.stringify({ seen, label, emptying, stopped }));
  }
  // The Risks section shows odds only for what can go off: a well never
  // burns or collapses, and a Tent never collapses ("0%" read as "safe for now").
  // A well, not a warehouse: the menu's sandbox has a random seed, and the
  // demo city builds a warehouse only where it finds clay by water, but
  // always its wells.
  const risks = await page.evaluate(() => {
    const app = window.colonia;
    const all = [...app.game.buildings.values()];
    const text = (b) => {
      if (!b) return null;
      app.ui.info.showBuilding(b.id);
      const sec = [...document.querySelectorAll('#info-panel .panel-sec')].find((s) => s.querySelector('h5')?.textContent === 'Risks');
      return sec ? sec.textContent : null;
    };
    const out = { well: text(all.find((b) => b.type === 'well')), shop: text(all.find((b) => !b.house && b.def.fire > 0 && b.def.damage > 0)) };
    const home = all.find((b) => b.house && b.house.pop > 0 && b.size === 1);
    if (home) {
      const was = home.house.tier;
      home.house.tier = 1;
      out.tent = text(home);
      home.house.tier = was;
    }
    app.ui.info.close();
    return out;
  });
  check('info panel risks: odds for a workplace, none for a well or a Tent\'s collapse',
    /never burns or collapses/.test(risks.well || '') && !/%/.test(risks.well || '')
    && /Fire risk\s*\d+%/.test(risks.shop || '') && /Collapse risk\s*\d+%/.test(risks.shop || '')
    && /Fire risk\s*\d+%/.test(risks.tent || '') && /Collapse risk\s*None: it cannot collapse/.test(risks.tent || ''),
    JSON.stringify(risks));
  await page.keyboard.press('F2');
  await page.click('.tab:has-text("Population")');
  const rows = await page.evaluate(() => [...document.querySelectorAll('.modal tr')].filter((tr) => /^\d+\. /.test(tr.textContent)).length);
  check('Population advisor lists 20 housing levels', rows === 20, `${rows} rows`);
  await page.keyboard.press('Escape');

  // 5a. Water radius: clicking a well shows its area (dark blue); placing one
  //     shows the new area in dark blue over existing coverage in pale blue.
  const well = await page.evaluate(() => {
    const g = window.colonia.game;
    const w = [...g.buildings.values()].find((b) => b.def.kind === 'well');
    if (!w) return null;
    window.colonia.renderer.camera.centerOnTile(w.x, w.y);
    return { x: w.x, y: w.y };
  });
  check('demo city has a well', !!well);
  if (well) {
    await page.waitForTimeout(100);
    const wp = await toScreen(well.x, well.y);
    await page.mouse.click(wp.x, wp.y);
    await page.waitForTimeout(150);
    const cov = await page.evaluate(() => window.colonia.renderer.stats.coverage);
    check('clicking a well shows its 5x5 supply area', !!cov && cov.strong === 25, JSON.stringify(cov));
    await page.evaluate(() => window.colonia.ui.selectTool('well'));
    const free = await page.evaluate(({ x, y }) => {
      const m = window.colonia.game.map;
      for (let r = 1; r < 6; r++) for (const [dx, dy] of [[r, 0], [0, r], [-r, 0], [0, -r]]) if (m.isFree(x + dx, y + dy)) return { x: x + dx, y: y + dy };
      return null;
    }, well);
    if (free) {
      const fp = await toScreen(free.x, free.y);
      await page.mouse.move(fp.x, fp.y);
      await page.waitForTimeout(150);
      const pc = await page.evaluate(() => window.colonia.renderer.stats.coverage);
      check('placing a well: new area dark, existing coverage pale', !!pc && pc.strong === 25 && pc.pale > 0, JSON.stringify(pc));
    }
    await page.keyboard.press('Escape'); // cancel the tool (a second Esc would open the pause menu)
    await page.evaluate(() => window.colonia.ui.info.close());

    // 5a (cont.) Water where you build: with the Housing tool in hand the
    // ground shows the water homes would get (well water faint, fountain
    // water stronger); a fountain or baths shows the reservoirs' piped area.
    // The demo city only has wells, so a piped area (wider than the preview
    // of a fountain under the cursor, as a reservoir's is) with some fountain
    // water in it is written into the water layer (the game is paused: it stays).
    const hints = await page.evaluate(async ({ x, y }) => {
      const app = window.colonia;
      const m = app.game.map;
      for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) if (m.inBounds(x + dx, y + dy)) m.water[m.idx(x + dx, y + dy)] |= 4; // PIPED
      for (let dy = -1; dy <= 1; dy++) for (let dx = 3; dx <= 5; dx++) if (m.inBounds(x + dx, y + dy)) m.water[m.idx(x + dx, y + dy)] |= 2; // FOUNTAIN
      const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await frame();
      const none = app.renderer.stats.waterHint;
      app.ui.selectTool('house');
      await frame();
      const house = app.renderer.stats.waterHint;
      app.ui.selectTool('fountain');
      await frame();
      const fountain = app.renderer.stats.waterHint;
      app.ui.selectTool('baths');
      await frame();
      const baths = app.renderer.stats.waterHint;
      return { none, house, fountain, baths };
    }, well);
    check('Housing tool: faint blue where homes get water (wells pale, fountains stronger)', hints.none === null && !!hints.house && hints.house.well > 0 && hints.house.fountain > 0, JSON.stringify(hints));
    check('placing a fountain or baths shows the reservoirs\' piped area', !!hints.fountain && hints.fountain.piped > 0 && !!hints.baths && hints.baths.piped > 0, JSON.stringify(hints));
    await page.keyboard.press('Escape');
  }

  // 5a2. Roadblocks and walkers: a roadblock placed from the build menu, its
  //      panel lets a group through; a click on a walker's figure opens the
  //      walker's panel, and Follow keeps it in view.
  const rbSpot = await page.evaluate(() => {
    const app = window.colonia;
    const m = app.game.map;
    // A straight piece of road in the demo city, away from the map edge.
    const home = [...app.game.buildings.values()].find((b) => b.house && b.house.pop > 0);
    for (let r = 1; r < 20; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = home.x + dx; const y = home.y + dy;
        if (!m.inBounds(x, y) || m.road[m.idx(x, y)] !== 1 || m.wall[m.idx(x, y)] || m.fixedRoad[m.idx(x, y)]) continue;
        if (m.hasRoad(x + 1, y) && m.hasRoad(x - 1, y) && !m.hasRoad(x, y + 1) && !m.hasRoad(x, y - 1)) {
          app.renderer.camera.centerOnTile(x, y);
          return { x, y };
        }
      }
    }
    return null;
  });
  check('demo city has a straight road for a roadblock', !!rbSpot);
  if (rbSpot) {
    await page.click('.cat-btn[title^="Roads"]');
    // Build menu entries are found by their key: the names are the Latin
    // ones, with the English under them (data/buildings.js `en`).
    const rbItem = await page.evaluate(() => {
      const el = document.querySelector('.build-item[data-key="roadblock"] .nm');
      return el ? { text: el.textContent, en: el.querySelector('.en')?.textContent, title: el.closest('.build-item').title } : null;
    });
    check('the build menu shows the Latin name with the English under it, and the tooltip both', !!rbItem && rbItem.text.startsWith('Claustra') && rbItem.en === 'Roadblock' && rbItem.title.startsWith('Claustra (Roadblock)\n'), JSON.stringify(rbItem));
    await page.click('.build-item[data-key="roadblock"]');
    await page.waitForTimeout(100);
    const rp = await toScreen(rbSpot.x, rbSpot.y);
    await page.mouse.move(rp.x, rp.y);
    await page.waitForTimeout(100);
    await page.mouse.click(rp.x, rp.y);
    const placed = await page.evaluate(({ x, y }) => window.colonia.game.map.roadblock[window.colonia.game.map.idx(x, y)], rbSpot);
    check('the Roadblock tool places a roadblock on a road', placed === 128, `layer ${placed}`);
    await page.mouse.click(rp.x, rp.y, { button: 'right' });
    // A click on a walker's figure picks the walker, and walkers cross the
    // roadblock all the time (a slow CI machine clicked one): step the paused
    // game until no figure stands at the point, then click the roadblock.
    const rbWasPaused = await page.evaluate(({ x, y }) => {
      const app = window.colonia;
      const was = app.paused;
      app.paused = true; // still until the click is done
      const rect = app.canvas.getBoundingClientRect();
      for (let k = 0; k < 60 && app.renderer.pickWalker(x - rect.left, y - rect.top, false); k++) {
        for (let t = 0; t < 4; t++) app.game.tick();
        app.renderer.render(0, 0.016);
      }
      return was;
    }, rp);
    await page.mouse.click(rp.x, rp.y);
    const rbPanel = (await page.textContent('#info-panel h3').catch(() => '')) === 'Claustra (Roadblock)';
    await page.evaluate((was) => { window.colonia.paused = was; }, rbWasPaused);
    await page.click('#info-panel label:has-text("Priests") input');
    const allowed = await page.evaluate(({ x, y }) => window.colonia.game.map.roadblock[window.colonia.game.map.idx(x, y)], rbSpot);
    check('clicking a roadblock shows who it lets through; ticking a group lets it pass', rbPanel && allowed === (128 | 2), `panel ${rbPanel}, layer ${allowed}`);
    // A walker in view, clicked on its body.
    await page.evaluate(() => { window.colonia.ui.info.close(); window.colonia.game.runDays(2); });
    await page.waitForTimeout(200);
    const findWalker = () => page.evaluate(() => {
      const r = window.colonia.renderer;
      const cam = r.camera;
      const rect = window.colonia.canvas.getBoundingClientRect();
      const g = window.colonia.game;
      // Plenty of walk left: a walker a few steps from home is gone by the release (the
      // press ticks the game 12 times), and three such in a row failed this check (v0.20.15:
      // walkers 44, 46 and 48 all left during the press). Those with the most road ahead first.
      const ahead = (id) => {
        const w = g.walkers.get(id);
        if (!w) return -1;
        if (w.path) return w.path.length - 1 - (w.pathIndex || 0);
        return w.roamLeft ?? 0;
      };
      const spots = [...r.walkerSpots].filter((s) => ahead(s.id) >= 8).sort((a, b) => ahead(b.id) - ahead(a.id));
      for (const s of spots) {
        const q = cam.toScreen(s.wx, s.wy - 9);
        const x = rect.left + q.x / cam.dpr;
        const y = rect.top + q.y / cam.dpr;
        if (x < rect.left + 360 || x > rect.right - 40 || y < rect.top + 80 || y > rect.bottom - 120) continue; // clear of the panels
        if (r.pickWalker(x - rect.left, y - rect.top) !== s.id) continue; // not hidden behind another walker
        return { id: s.id, x, y };
      }
      return null;
    });
    let target = await findWalker();
    let how = 'one in view';
    if (!target) {
      // The menu picks a random map, and on about one in ten no walker is in
      // view near the roadblock two days on (the check failed now and then
      // for that reason alone). Bring one into view instead of hoping; a city
      // with no walker on its roads still fails.
      how = await page.evaluate(() => {
        const g = window.colonia.game;
        // Away from the map's edges (the camera stops at the border, so a walker
        // at the entrance, like a newcomer, would sit under the top panel), and
        // a street walker if there is one.
        const m = g.map;
        const inland = (v) => m.road[m.idx(v.x, v.y)] && v.x > 15 && v.y > 15 && v.x < m.w - 15 && v.y < m.h - 15;
        const all = [...g.walkers.values()];
        const w = all.find((v) => inland(v) && v.kind === 'roamer') || all.find(inland);
        if (!w) return `no walker on a road (${g.walkers.size} walkers, seed ${g.seed})`;
        window.colonia.renderer.camera.centerOnTile(w.x, w.y);
        return `none in view (seed ${g.seed}), centered on walker type ${w.type}`;
      });
      await page.waitForTimeout(200);
      target = await findWalker();
    }
    check('walkers are on screen to click', !!target, how);
    if (target) {
      await page.mouse.click(target.x, target.y);
      await page.waitForTimeout(150);
      const wp = await page.evaluate(() => ({
        target: window.colonia.ui.info.target,
        ring: window.colonia.renderer.selectedWalker,
        head: document.querySelector('#info-panel h3')?.textContent || '',
        says: document.querySelector('#info-panel .walker-says')?.textContent || '',
      }));
      check('clicking a walker opens its panel: who it is and what it says', wp.target?.kind === 'walker' && wp.target.id === target.id && wp.ring === target.id && wp.head.length > 0 && wp.says.length > 4, JSON.stringify(wp));
      await page.click('#info-panel button:has-text("Follow")');
      const following = await page.evaluate(() => !!window.colonia.renderer.follow);
      await page.mouse.click(target.x, target.y, { button: 'right' });
      const closed = await page.evaluate(() => !window.colonia.renderer.follow && !window.colonia.renderer.selectedWalker);
      check('Follow keeps a walker in view; closing the panel lets go', following && closed, JSON.stringify({ following, closed }));
      // The walker pressed on is the one clicked, even if it has walked on
      // by the release (at 4x it covers half a tile in a click).
      // Paused while it aims: running (at 4x since step 5) a walker could
      // walk out from under the pointer between finding it and the press,
      // and the check failed now and then for that reason alone.
      const wasPaused = await page.evaluate(() => { const app = window.colonia; const was = app.paused; if (!was) app.togglePause(); return was; });
      await page.waitForTimeout(50);
      // A walker can finish its trip during the press (it then leaves the map,
      // and the click rightly finds nothing: a failure once in about ten
      // runs). Such a try does not count; another walker is pressed instead.
      let press = null;
      const tries = []; // (each attempt, for the detail on failure: it failed once in CI with nothing to go on, v0.20.10)
      for (let attempt = 0; attempt < 3 && !press; attempt++) {
        const fresh = await findWalker();
        if (!fresh) { tries.push('no walker on screen'); break; }
        await page.mouse.move(fresh.x, fresh.y);
        // What the click logic sees at the press (in the detail on failure).
        const seen = await page.evaluate(({ x, y }) => {
          const app = window.colonia;
          const r = app.renderer;
          const rect = app.canvas.getBoundingClientRect();
          const sx = x - rect.left;
          const sy = y - rect.top;
          const t = r.camera.screenToTile(sx, sy);
          const m = app.game.map;
          return { strict: r.pickWalker(sx, sy, false), loose: r.pickWalker(sx, sy, true), tool: app.input.tool || null, tile: t, building: m.inBounds(t.x, t.y) ? m.buildingAt(t.x, t.y) : -1, paused: app.paused };
        }, fresh);
        await page.mouse.down();
        await page.evaluate(() => { const app = window.colonia; for (let k = 0; k < 12; k++) app.game.tick(); app.renderer.render(0, 0.016); });
        await page.mouse.up();
        await page.waitForTimeout(150);
        const got = await page.evaluate(() => window.colonia.ui.info.target);
        const stayed = await page.evaluate((id) => window.colonia.game.walkers.has(id), fresh.id);
        await page.mouse.click(fresh.x, fresh.y, { button: 'right' });
        if (stayed) press = { got, want: fresh.id, seen, attempt };
        else tries.push(`walker ${fresh.id} left the map during the press`);
      }
      check('a walker pressed on is the one clicked, even if it walked on before the release', !!press && press.got?.kind === 'walker' && press.got.id === press.want, JSON.stringify(press || { tries }));
      if (!wasPaused) await page.evaluate(() => window.colonia.togglePause());
    }
  }

  // 5a2b. Rubble remembers what stood there and offers to rebuild it, on the
  //      same spot, from its panel.
  const fell = await page.evaluate(() => {
    const app = window.colonia;
    const reply = app.ui.console.run('collapse');
    const m = /at (\d+),(\d+)/.exec(reply);
    if (!m) return { reply };
    const x = Number(m[1]);
    const y = Number(m[2]);
    app.ui.info.showTile(x, y);
    return { x, y, rubble: app.game.map.rubble[app.game.map.idx(x, y)] };
  });
  let rebuilt = null;
  if (fell.x !== undefined) {
    const label = await page.textContent('#info-panel button:has-text("Rebuild")').catch(() => null);
    await page.click('#info-panel button:has-text("Rebuild")').catch(() => {});
    rebuilt = await page.evaluate(({ x, y }) => ({ standing: window.colonia.game.map.buildingAt(x, y) > 0, panel: window.colonia.ui.info.target?.kind }), fell);
    rebuilt.label = label;
    await page.evaluate(() => window.colonia.ui.info.close());
  }
  check('rubble offers to rebuild what stood there, on the same spot', fell.rubble === 1 && !!rebuilt && rebuilt.standing && /^Rebuild the .+ \(\d+ Dn\)$/.test(rebuilt.label || ''), JSON.stringify({ fell, rebuilt }));

  // 5a2c. The hippodrome: built with the console's builder (the player's
  //       construction API), its panel shows the races; a click on any
  //       section of the track opens the hippodrome's panel. (Fishing is
  //       checked on the fixed coast map below: this map's seed is random,
  //       and some maps have no water with fishing grounds near the city.)
  const water = await page.evaluate(() => {
    const app = window.colonia;
    const g = app.game;
    const free = g.cheats.freeBuild;
    g.cheats.freeBuild = true;
    const out = { hip: app.ui.console.run('hippodrome') };
    const find = (k) => [...g.buildings.values()].find((b) => b.def.kind === k || b.type === k);
    if (!find('hippodrome_part')) {
      // No 15 x 5 of open land 8 to 34 tiles from the city on this random map (a wooded one:
      // trees count as taken; seed 243207 failed so). The check is of the panel, not the map:
      // clear the trees round the city, say so, and build again.
      const homes = [...g.buildings.values()].filter((b) => b.house);
      const cx = homes.reduce((s, b) => s + b.x, 0) / Math.max(1, homes.length);
      const cy = homes.reduce((s, b) => s + b.y, 0) / Math.max(1, homes.length);
      const m = g.map;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (Math.hypot(x - cx, y - cy) <= 40 && m.terrain[m.idx(x, y)] === 2) m.terrain[m.idx(x, y)] = 0;
      m.touch();
      console.log(`smoke: no room for the hippodrome on seed ${g.seed}: cleared the trees round the city`);
      out.cleared = true;
      out.hip2 = app.ui.console.run('hippodrome');
    }
    g.cheats.freeBuild = free;
    const text = () => document.querySelector('#info-panel')?.textContent || '';
    const part = find('hippodrome_part');
    if (part) { app.ui.info.showBuilding(part.id); out.target = app.ui.info.target?.id; out.main = part.main; out.hipPanel = text(); }
    app.ui.info.close();
    app.renderer.render(0, 0.016);
    return out;
  });
  check('a hippodrome can be placed; any section opens its panel with the races', !!water.main && water.target === water.main && /Races/.test(water.hipPanel || '') && errors.length === 0, JSON.stringify({ hip: water.hip, target: water.target, main: water.main }));

  // 5a2c2. Turned with R, the hippodrome lies north-south: the old one is
  //        cleared, the Circus picked, R pressed, and the ghost (the player's
  //        own plan) is put down where all of it fits, its sections along y.
  const hipBefore = await page.evaluate(() => {
    const app = window.colonia;
    const g = app.game;
    const main = [...g.buildings.values()].find((b) => b.type === 'hippodrome');
    if (main) {
      app.ui.selectTool('clear');
      app.input.hover = { x: main.x, y: main.y };
      app.input.mouse.over = true;
      app.input.refreshPlan();
      app.applyPlan(app.renderer.plan);
    }
    app.ui.selectTool('hippodrome');
    return { cleared: ![...g.buildings.values()].some((b) => b.type.startsWith('hippodrome')) };
  });
  await page.keyboard.press('r');
  const hipNS = await page.evaluate(() => {
    const app = window.colonia;
    const g = app.game;
    const free = g.cheats.freeBuild;
    g.cheats.freeBuild = true;
    const out = { turn: app.input.turnFor('hippodrome') };
    const c = app.renderer.camera.screenToTile(app.renderer.camera.viewW / 2, app.renderer.camera.viewH / 2);
    app.input.mouse.over = true;
    search: for (let r = 0; r < 60; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        app.input.hover = { x: Math.round(c.x) + dx, y: Math.round(c.y) + dy };
        app.input.refreshPlan();
        const p = app.renderer.plan;
        if (p && p.items.length === 3 && p.items.every((it) => it.ok)) { out.ghostTurn = p.turn; app.applyPlan(p); break search; }
      }
    }
    g.cheats.freeBuild = free;
    const main = [...g.buildings.values()].find((b) => b.type === 'hippodrome');
    if (main) {
      const group = [main, ...main.parts.map((id) => g.buildings.get(id))];
      out.sections = group.map((b) => [b.x - main.x, b.y - main.y, b.turn]);
      out.at = [main.x, main.y];
    }
    out.view = [Math.round(c.x), Math.round(c.y)];
    app.ui.selectTool(null);
    delete app.input.turns.hippodrome;
    return out;
  });
  if (shots && hipNS.at) {
    await page.evaluate(([x, y]) => window.colonia.renderer.camera.centerOnTile(x + 2, y + 7), hipNS.at);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shots, 'smoke-hippodrome-ns.png') });
  }
  await page.evaluate(([x, y]) => window.colonia.renderer.camera.centerOnTile(x, y), hipNS.view); // (back to the city for the next steps)
  check('turned with R, the hippodrome is placed north-south, its three sections along y', hipBefore.cleared && hipNS.turn === 1 && hipNS.ghostTurn === 1 && JSON.stringify(hipNS.sections) === JSON.stringify([[0, 0, 1], [0, 5, 1], [0, 10, 1]]), JSON.stringify({ hipBefore, hipNS }));

  // 5a2d. The victory screen's festival music ends with the screen: "Keep
  //       building" used to leave it on for the rest of the game.
  const won = await page.evaluate(() => {
    const app = window.colonia;
    const boost = app.game.city.festivalBoost;
    app.game.city.festivalBoost = 0;
    app.onVictory();
    const during = app.musicMood();
    return { during, boost };
  });
  await page.click('.modal button:has-text("Keep building")');
  const kept = await page.evaluate((boost) => { const app = window.colonia; const mood = app.musicMood(); app.game.city.festivalBoost = boost; return { mood, override: app.musicOverride, modal: app.ui.hasModal() }; }, won.boost);
  check('victory plays festival music until "Keep building", then the music follows the city again', won.during === 'festival' && kept.override === null && kept.mood !== 'festival' && !kept.modal, JSON.stringify({ won, kept }));

  // 5a2d. The cloth industry from the build menu: each of the three buildings
  //       is in its category, the click picks it as the tool, and a click on
  //       the map places it (the flax farm on meadow, all beside a road).
  const clothPlaced = [];
  for (const [cat, key, size] of [['Farms', 'farm_flax', 3], ['Industry', 'linen_ws', 2], ['Industry', 'clothing_ws', 2]]) {
    const at = await page.evaluate(({ size, meadow }) => {
      const app = window.colonia;
      const m = app.game.map;
      const home = [...app.game.buildings.values()].find((b) => b.house && b.house.pop > 0);
      // Top-left corners of free land with a road along an edge; a farm needs
      // some meadow under it, as the game's own rule says (asking for all nine
      // tiles found no spot on maps whose fields lie back from the roads).
      const fits = (x, y) => {
        let fertile = 0;
        for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
          const i = m.idx(x + dx, y + dy);
          if (!m.isFree(x + dx, y + dy) || m.terrain[i] === 2) return false;
          if (m.terrain[i] === 1) fertile++;
        }
        if (meadow && fertile === 0) return false;
        for (let k = 0; k < size; k++) if (m.hasRoad(x + k, y - 1) || m.hasRoad(x + k, y + size) || m.hasRoad(x - 1, y + k) || m.hasRoad(x + size, y + k)) return true;
        return false;
      };
      for (let r = 2; r < 60; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = home.x + dx; const y = home.y + dy;
          if (!m.inBounds(x, y) || !m.inBounds(x + size, y + size) || !fits(x, y)) continue;
          // planAction takes a big building by its middle tile.
          const off = Math.floor((size - 1) / 2);
          app.renderer.camera.centerOnTile(x + off, y + off);
          app.renderer.render(0, 0.016);
          return { x, y, ax: x + off, ay: y + off };
        }
      }
      // The menu's sandbox has a random seed: on some maps no free meadow
      // touches a road. Then the free meadow nearest a road (walking over
      // open land, at most 10 tiles) will do, and the test drags a road to
      // it first (`link`: from a road tile to a tile beside the field).
      if (!meadow) return null;
      const free = (x, y) => {
        for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) if (!m.inBounds(x + dx, y + dy) || !m.isFree(x + dx, y + dy) || m.terrain[m.idx(x + dx, y + dy)] !== 1) return false;
        return true;
      };
      // Breadth first from every road tile over open land: how far, and from which road tile.
      const dist = new Map();
      const from = new Map();
      const queue = [];
      for (let i = 0; i < m.size; i++) if (m.road[i]) { dist.set(i, 0); from.set(i, i); queue.push(i); }
      for (let q = 0; q < queue.length; q++) {
        const i = queue[q];
        if (dist.get(i) >= 10) continue;
        const x = m.xOf(i); const y = m.yOf(i);
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (!m.inBounds(nx, ny)) continue;
          const j = m.idx(nx, ny);
          if (dist.has(j) || !m.isFree(nx, ny) || m.terrain[j] === 2) continue;
          dist.set(j, dist.get(i) + 1); from.set(j, from.get(i)); queue.push(j);
        }
      }
      let best = null;
      for (let y = 1; y < m.h - size - 1; y++) {
        for (let x = 1; x < m.w - size - 1; x++) {
          if (!free(x, y)) continue;
          for (let k = 0; k < size; k++) {
            for (const [lx, ly] of [[x + k, y - 1], [x + k, y + size], [x - 1, y + k], [x + size, y + k]]) {
              const d = dist.get(m.idx(lx, ly));
              if (d === undefined || d === 0 || (best && d >= best.d)) continue;
              const r = from.get(m.idx(lx, ly));
              best = { d, x, y, link: { x: lx, y: ly, rx: m.xOf(r), ry: m.yOf(r) } };
            }
          }
        }
      }
      if (!best) {
        // No free meadow within 10 tiles of any road on this map (the cause of
        // this check's occasional failure since v0.18.8: the map, not the rule).
        // The check is of the menu and the placing, so lay one meadow tile under
        // a free spot by a road, as a farm needs some meadow under it, and say so.
        for (let r = 2; r < 60; r++) {
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = home.x + dx; const y = home.y + dy;
            if (!m.inBounds(x, y) || !m.inBounds(x + size, y + size)) continue;
            let open = true;
            for (let ty = 0; ty < size && open; ty++) for (let tx = 0; tx < size; tx++) if (!m.isFree(x + tx, y + ty) || m.terrain[m.idx(x + tx, y + ty)] === 2) { open = false; break; }
            let byRoad = false;
            for (let k = 0; k < size; k++) if (m.hasRoad(x + k, y - 1) || m.hasRoad(x + k, y + size) || m.hasRoad(x - 1, y + k) || m.hasRoad(x + size, y + k)) byRoad = true;
            if (!open || !byRoad) continue;
            const off = Math.floor((size - 1) / 2);
            m.terrain[m.idx(x + off, y + off)] = 1;
            m.touch();
            console.log(`smoke: no meadow near a road on seed ${app.game.seed}: laid one at ${x + off},${y + off}`);
            app.renderer.camera.centerOnTile(x + off, y + off);
            app.renderer.render(0, 0.016);
            return { x, y, ax: x + off, ay: y + off, laid: true };
          }
        }
        return null;
      }
      const off = Math.floor((size - 1) / 2);
      app.renderer.camera.centerOnTile(Math.round((best.link.x + best.link.rx) / 2), Math.round((best.link.y + best.link.ry) / 2));
      app.renderer.render(0, 0.016);
      return { x: best.x, y: best.y, ax: best.x + off, ay: best.y + off, link: best.link };
    }, { size, meadow: key === 'farm_flax' });
    if (at && at.link) {
      // Drag a road from the road tile out to the field's edge, then look at the field.
      await page.evaluate(() => window.colonia.ui.selectTool('road'));
      await page.waitForTimeout(100);
      const a = await toScreen(at.link.rx, at.link.ry);
      const b = await toScreen(at.link.x, at.link.y);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
      await page.mouse.move(b.x, b.y, { steps: 5 });
      await page.mouse.up();
      await page.keyboard.press('Escape');
      await page.evaluate(({ ax, ay }) => { window.colonia.renderer.camera.centerOnTile(ax, ay); window.colonia.renderer.render(0, 0.016); }, at);
    }
    await page.click(`.cat-btn[title^="${cat}"]`);
    const listed = await page.isVisible(`.build-item[data-key="${key}"]`);
    if (listed) await page.click(`.build-item[data-key="${key}"]`);
    const tool = await page.evaluate(() => window.colonia.input.tool);
    let placed = null;
    if (at && tool === key) {
      const p = await toScreen(at.ax, at.ay);
      await page.mouse.move(p.x - 4, p.y);
      await page.mouse.move(p.x, p.y);
      await page.waitForTimeout(100);
      await page.mouse.click(p.x, p.y);
      placed = await page.evaluate(({ x, y, key }) => {
        const app = window.colonia;
        const b = app.game.buildings.get(app.game.map.building[app.game.map.idx(x, y)]);
        return b && b.type === key ? { type: b.type, x: b.x, y: b.y, road: b.accessRoad >= 0 } : null;
      }, { ...at, key });
    }
    if (await page.evaluate(() => window.colonia.input.tool)) await page.keyboard.press('Escape');
    clothPlaced.push({ key, listed, tool, at, placed });
  }
  check('the Linarium, Textrinum and Taberna Vestiaria (the cloth chain) are in the build menu and can be placed', clothPlaced.every((c) => c.listed && c.tool === c.key && c.placed && c.placed.x === c.at.x && c.placed.y === c.at.y && c.placed.road) && errors.length === 0, JSON.stringify(clothPlaced));

  // 5a2e. The governor: his house picked from the build menu and placed with
  //       the mouse on open land (no road needed), then the Imperial advisor:
  //       his rank and savings, a salary picked from the list, and a gift
  //       paid from his savings.
  const govAt = await page.evaluate(() => {
    const app = window.colonia;
    const m = app.game.map;
    const home = [...app.game.buildings.values()].find((b) => b.house && b.house.pop > 0);
    const fits = (x, y) => {
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) if (!m.inBounds(x + dx, y + dy) || !m.isFree(x + dx, y + dy) || m.terrain[m.idx(x + dx, y + dy)] === 2) return false;
      return true;
    };
    for (let r = 4; r < 60; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !fits(home.x + dx, home.y + dy)) continue;
        app.renderer.camera.centerOnTile(home.x + dx + 1, home.y + dy + 1);
        app.renderer.render(0, 0.016);
        return { x: home.x + dx, y: home.y + dy };
      }
    }
    return null;
  });
  await page.click('.cat-btn[title^="Government"]');
  const govListed = await page.isVisible('.build-item[data-key="governor_house"]');
  if (govListed) await page.click('.build-item[data-key="governor_house"]');
  const govTool = await page.evaluate(() => window.colonia.input.tool);
  if (govAt && govTool === 'governor_house') {
    const p = await toScreen(govAt.x + 1, govAt.y + 1);
    await page.mouse.move(p.x - 4, p.y);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(100);
    await page.mouse.click(p.x, p.y);
  }
  if (await page.evaluate(() => window.colonia.input.tool)) await page.keyboard.press('Escape');
  const govPlaced = await page.evaluate(() => {
    const b = [...window.colonia.game.buildings.values()].find((x) => x.def.kind === 'residence');
    return b ? { type: b.type, x: b.x, y: b.y } : null;
  });
  check('the Governor\'s House is in the build menu and can be placed', govListed && govTool === 'governor_house' && govPlaced && govPlaced.x === govAt.x && govPlaced.y === govAt.y && errors.length === 0, JSON.stringify({ govListed, govTool, govAt, govPlaced }));
  // Its panel's title: the Latin name with the English after it.
  const govHead = await page.evaluate(() => {
    const app = window.colonia;
    const b = [...app.game.buildings.values()].find((x) => x.def.kind === 'residence');
    if (!b) return null;
    app.ui.info.showBuilding(b.id);
    const head = document.querySelector('#info-panel h3')?.textContent || '';
    app.ui.info.close();
    return head;
  });
  check('a building\'s panel title shows its Latin name with the English after it', govHead === 'Praetorium (Governor\'s House)', JSON.stringify(govHead));

  // 5a2f. Building in marble (sim/construction.js marbleCost): with no marble
  //       in the warehouses the Government menu shows a Statua's 100 marble
  //       under its denarii, greyed out with the reason, and a click does not
  //       pick it; held anyway, it is refused where it would go, saying why,
  //       and nothing is built. With 100 marble given, the menu opens it again
  //       and the click places it, the marble gone from the warehouse.
  const marbleAt = await page.evaluate(() => {
    const app = window.colonia;
    const g = app.game;
    const m = g.map;
    for (const b of g.buildings.values()) if (b.def.kind === 'warehouse') b.stock.marble = 0;
    const home = [...g.buildings.values()].find((b) => b.house && b.house.pop > 0);
    const fits = (x, y) => {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if (!m.inBounds(x + dx, y + dy) || !m.isFree(x + dx, y + dy) || m.terrain[m.idx(x + dx, y + dy)] === 2) return false;
      return true;
    };
    for (let r = 3; r < 60; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !fits(home.x + dx, home.y + dy)) continue;
        app.renderer.camera.centerOnTile(home.x + dx + 1, home.y + dy + 1);
        app.renderer.render(0, 0.016);
        return { x: home.x + dx, y: home.y + dy, warehouses: [...g.buildings.values()].filter((b) => b.def.kind === 'warehouse').length };
      }
    }
    return null;
  });
  const statueItem = () => page.evaluate(() => {
    const sb = window.colonia.ui.sidebar;
    sb.marbleAt = 0; // (look again now, not in 400 ms)
    sb.update(performance.now());
    const el = document.querySelector('.build-item[data-key="statue_medium"]');
    return el ? { cost: el.querySelector('.cost')?.textContent || '', locked: el.classList.contains('locked'), title: el.title } : null;
  });
  if (await page.evaluate(() => window.colonia.ui.sidebar.category !== 'government')) await page.click('.cat-btn[title^="Government"]');
  const shortItem = await statueItem();
  await page.click('.build-item[data-key="statue_medium"]');
  const shortTool = await page.evaluate(() => window.colonia.input.tool);
  check('the build menu shows a Statua\'s marble under its denarii, greyed out saying how much is short; a click does not pick it',
    !!shortItem && /60 Dn/.test(shortItem.cost) && /100 marble/.test(shortItem.cost) && shortItem.locked && /Needs 100 marble in the warehouses, 0 stored/.test(shortItem.title) && shortTool !== 'statue_medium',
    JSON.stringify({ shortItem, shortTool }));
  let marbleRefused = null;
  let marblePlaced = null;
  if (marbleAt) {
    await page.evaluate(() => window.colonia.ui.selectTool('statue_medium'));
    const p = await toScreen(marbleAt.x, marbleAt.y);
    await page.mouse.move(p.x - 4, p.y);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(100);
    const said = await page.evaluate(() => document.querySelector('#sidebar')?.textContent || '');
    await page.mouse.click(p.x, p.y);
    marbleRefused = await page.evaluate(({ x, y }) => {
      const g = window.colonia.game;
      const toast = [...document.querySelectorAll('#messages .toast')].map((t) => t.textContent).join(' | ');
      return { built: !!g.map.building[g.map.idx(x, y)], toast };
    }, marbleAt);
    marbleRefused.said = /Needs 100 marble in the warehouses, 0 stored/.test(said);
    await page.keyboard.press('Escape');
    // A Horreum for the marble where the demo city has none (it varies with
    // the sandbox's map): placed with the mouse beside the statue's spot.
    if (!marbleAt.warehouses) {
      const whAt = await page.evaluate(({ x, y }) => {
        const m = window.colonia.game.map;
        const fits = (wx, wy) => {
          for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
            const tx = wx + dx;
            const ty = wy + dy;
            if (!m.inBounds(tx, ty) || !m.isFree(tx, ty) || m.terrain[m.idx(tx, ty)] === 2) return false;
            if (tx >= x - 1 && tx <= x + 2 && ty >= y - 1 && ty <= y + 2) return false; // (keep the statue's spot free)
          }
          return true;
        };
        for (let r = 3; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && fits(x + dx, y + dy)) return { x: x + dx, y: y + dy };
        return null;
      }, marbleAt);
      if (whAt) {
        await page.evaluate(() => window.colonia.ui.selectTool('warehouse'));
        const q = await toScreen(whAt.x + 1, whAt.y + 1); // (held by its middle tile)
        await page.mouse.move(q.x - 4, q.y);
        await page.mouse.move(q.x, q.y);
        await page.waitForTimeout(100);
        await page.mouse.click(q.x, q.y);
        if (await page.evaluate(() => window.colonia.input.tool)) await page.keyboard.press('Escape');
      }
    }
    // Now with the marble: the menu opens it again, and the click builds it.
    const gave = await page.evaluate(() => window.colonia.ui.console.run('give marble 100'));
    // (Picking the Horreum opened its own menu: back to Government.)
    if (await page.evaluate(() => window.colonia.ui.sidebar.category !== 'government')) await page.click('.cat-btn[title^="Government"]');
    const okItem = await statueItem();
    await page.click('.build-item[data-key="statue_medium"]');
    const tool = await page.evaluate(() => window.colonia.input.tool);
    await page.mouse.move(p.x - 4, p.y);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(100);
    await page.mouse.click(p.x, p.y);
    marblePlaced = await page.evaluate(({ x, y }) => {
      const g = window.colonia.game;
      const b = g.buildings.get(g.map.building[g.map.idx(x, y)]);
      let marble = 0;
      for (const w of g.buildings.values()) if (w.def.kind === 'warehouse') marble += w.stock.marble || 0;
      return { type: b?.type || null, marble };
    }, marbleAt);
    Object.assign(marblePlaced, { gave, locked: okItem?.locked, tool });
    if (await page.evaluate(() => window.colonia.input.tool)) await page.keyboard.press('Escape');
  }
  check('held anyway, a Statua is refused for want of marble, saying why, and nothing is built',
    !!marbleAt && marbleRefused && !marbleRefused.built && marbleRefused.said && /Needs 100 marble/.test(marbleRefused.toast),
    JSON.stringify({ marbleAt, marbleRefused }));
  check('with 100 marble in a warehouse the Statua opens again and is placed, the marble taken',
    !!marblePlaced && marblePlaced.locked === false && marblePlaced.tool === 'statue_medium' && marblePlaced.type === 'statue_medium' && marblePlaced.marble === 0 && errors.length === 0,
    JSON.stringify({ marbleAt, marblePlaced }));
  await page.keyboard.press('F2');
  await page.click('.tab:has-text("Imperial")');
  const govText = await page.textContent('.governor-card');
  // Every rank is listed, those above the governor's (a Procurator's, 5)
  // greyed out: Rome pays no governor above his rank.
  const salaryOptions = await page.evaluate(() => [...document.querySelectorAll('.salary-select option')].map((o) => ({ v: Number(o.value), off: o.disabled, text: o.textContent })));
  await page.selectOption('.salary-select', '4');
  const salaryRank = await page.evaluate(() => window.colonia.game.city.governor.salaryRank);
  check('the salary picker offers the governor\'s rank and those below it; the ranks above are listed greyed out',
    salaryOptions.length === 11 && salaryOptions.every((o) => o.off === (o.v > 5)) && /Aedile: 30 Dn a month \(above your rank\)/.test(salaryOptions[6]?.text) && /\(your rank\)/.test(salaryOptions[5]?.text) && salaryRank === 4 && errors.length === 0,
    JSON.stringify({ salaryOptions: salaryOptions.map((o) => `${o.v}${o.off ? ' off' : ''}`), salaryRank }));
  const before = await page.evaluate(() => {
    const g = window.colonia.game;
    window.colonia.ui.console.run(`savings ${400 - g.city.governor.savings}`);
    return { favor: g.city.ratings.favor, treasury: g.city.treasury };
  });
  await page.click('.tab:has-text("Imperial")'); // shown again with the new savings
  const lavish = await page.textContent('.gift-btn:has-text("Lavish")');
  await page.click('.gift-btn:has-text("Lavish")');
  const after = await page.evaluate(() => ({ savings: window.colonia.game.city.governor.savings, favor: window.colonia.game.city.ratings.favor, treasury: window.colonia.game.city.treasury }));
  check('the Imperial advisor shows the rank and savings, sets the salary and sends a gift from savings', /Procurator/.test(govText) && /Personal savings/.test(govText) && salaryRank === 4 && /300 Dn \(\+10 favor\)/.test(lavish) && after.savings === 100 && after.favor > before.favor && after.treasury === before.treasury && errors.length === 0, JSON.stringify({ govText: govText.slice(0, 120), salaryRank, lavish, before, after }));
  await page.keyboard.press('Escape');

  // 5a3. The Problems overlay: a legend, and the reason over a flagged building;
  //      the Production advisor and the trend charts.
  await page.selectOption('.hud-select', 'problems');
  const flagged = await page.evaluate(async () => {
    const app = window.colonia;
    const g = app.game;
    const ov = app.renderer.overlay;
    const b = [...g.buildings.values()].find((x) => ov.tip(g, x) && x.size === 1);
    if (!b) return null;
    app.renderer.camera.centerOnTile(b.x, b.y);
    return { x: b.x, y: b.y, text: ov.tip(g, b) };
  });
  check('the Problems overlay flags something in the demo city', !!flagged);
  if (flagged) {
    await page.waitForTimeout(150);
    const fp = await toScreen(flagged.x, flagged.y);
    await page.mouse.move(fp.x, fp.y);
    await page.waitForTimeout(250);
    const tip = await page.evaluate(() => { const t = document.getElementById('tooltip'); return { shown: !t.classList.contains('hidden'), text: t.textContent }; });
    const legend = await page.isVisible('#overlay-legend:has-text("Home needs: water")');
    check('Problems overlay: a legend, and pointing at a building says what is wrong', tip.shown && tip.text === flagged.text && legend, JSON.stringify({ tip, legend, want: flagged.text }));
  }
  // 5a3b. The crime overlay, with a protester, a thief and a riot on the
  //       streets (drawn by their own art); then the criminals are cleared so
  //       they cannot upset the checks that follow.
  await page.evaluate(() => {
    const con = window.colonia.ui.console;
    con.run('crime protest');
    con.run('crime thief');
    con.run('riot');
  });
  await page.selectOption('.hud-select', 'crime');
  const crimeHome = await page.evaluate(() => {
    const app = window.colonia;
    const g = app.game;
    const ov = app.renderer.overlay;
    const b = [...g.buildings.values()].find((x) => x.house && x.house.pop > 0 && x.size === 1 && ov.tip(g, x));
    if (b) app.renderer.camera.centerOnTile(b.x, b.y);
    const about = {};
    for (const w of g.walkers.values()) if (w.kind === 'criminal') about[w.type] = (about[w.type] || 0) + 1;
    return { key: ov.key, about, home: b ? { x: b.x, y: b.y, text: ov.tip(g, b) } : null };
  });
  await page.waitForTimeout(300);
  let crimeTipShown = null;
  if (crimeHome.home) {
    const cp = await toScreen(crimeHome.home.x, crimeHome.home.y);
    await page.mouse.move(cp.x, cp.y);
    await page.waitForTimeout(250);
    crimeTipShown = await page.evaluate(() => document.getElementById('tooltip').textContent);
  }
  const crimeLegend = await page.isVisible('#overlay-legend:has-text("Little crime")');
  // The criminals appear by the unhappiest home, which on some random maps is
  // out of view of the home above: look at the protester (it stands still)
  // and count the criminals actually drawn there.
  await page.evaluate(() => {
    const app = window.colonia;
    const p = [...app.game.walkers.values()].find((w) => w.type === 'protester');
    if (p) app.renderer.camera.centerOnTile(p.x, p.y);
  });
  await page.waitForTimeout(300);
  const crimeDrawn = await page.evaluate(() => {
    const g = window.colonia.game;
    return window.colonia.renderer.walkerSpots.filter((s) => g.walkers.get(s.id)?.kind === 'criminal').length;
  });
  check('the crime overlay opens: legend, a home\'s mood on hover, criminals drawn, no errors',
    crimeHome.key === 'crime' && !!crimeHome.home && /Mood \d+/.test(crimeTipShown || '') && crimeLegend && crimeHome.about.protester >= 1 && crimeHome.about.thief >= 1 && crimeHome.about.rioter >= 1 && crimeDrawn > 0 && errors.length === 0,
    JSON.stringify({ ...crimeHome, crimeTipShown, crimeLegend, crimeDrawn, errors }));
  await page.evaluate(() => {
    const g = window.colonia.game;
    for (const w of [...g.walkers.values()]) if (w.kind === 'criminal') { w.dead = true; g.walkers.delete(w.id); }
  });
  // 5a3c. The Disease overlay, with a home made sick from the console: its
  //       column, its words on hover, the legend, no errors.
  const sickHome = await page.evaluate(() => {
    const app = window.colonia;
    const g = app.game;
    const b = [...g.buildings.values()].find((x) => x.house && x.house.pop >= 4 && x.size === 1);
    if (!b) return null;
    const said = app.ui.console.run(`sick ${b.x} ${b.y}`);
    app.renderer.camera.centerOnTile(b.x, b.y);
    return { x: b.x, y: b.y, said, sick: b.house.sick };
  });
  await page.selectOption('.hud-select', 'disease');
  await page.waitForTimeout(300);
  let healthTipShown = null;
  if (sickHome) {
    const hp = await toScreen(sickHome.x, sickHome.y);
    await page.mouse.move(hp.x, hp.y);
    await page.waitForTimeout(250);
    healthTipShown = await page.evaluate(() => document.getElementById('tooltip').textContent);
  }
  const healthLegend = await page.isVisible('#overlay-legend:has-text("Sick home")');
  const healthReport = await page.evaluate(() => window.colonia.ui.console.run('health'));
  check('the Disease overlay opens: a sick home marked, its health on hover, the legend, no errors',
    !!sickHome && sickHome.sick > 0 && /Sick: \d+ days? left/.test(healthTipShown || '') && /Health \d+/.test(healthTipShown || '') && healthLegend && /City health \d+/.test(healthReport) && errors.length === 0,
    JSON.stringify({ sickHome, healthTipShown, healthLegend, healthReport: healthReport.slice(0, 200), errors }));
  await page.selectOption('.hud-select', 'none');
  const legendGone = await page.isHidden('#overlay-legend');
  // Out of the overlay too, the sick home carries its green sign, and its
  // panel opens on the outbreak (playtest: both were easy to miss).
  const sickShown = sickHome ? await page.evaluate(async ({ x, y }) => {
    const app = window.colonia;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const b = app.game.buildings.get(app.game.map.buildingAt(x, y));
    app.ui.info.showBuilding(b.id);
    const first = document.querySelector('#info-panel .status')?.textContent || '';
    app.ui.info.close();
    return { signs: app.renderer.stats.sickSigns, first };
  }, sickHome) : null;
  check('a sick home shows a sign on the map, and its panel opens on the outbreak', !!sickShown && sickShown.signs >= 1 && /Disease outbreak/.test(sickShown.first), JSON.stringify(sickShown));
  // Wheat in store, so the goods table has a row to show however young the
  // city is (the check used to find "Wheat" in a Wheat Farm's trouble line,
  // and the young city had made and stored nothing yet).
  await page.evaluate(() => window.colonia.ui.console.run('give wheat 400'));
  await page.keyboard.press('F2');
  await page.click('.tab:has-text("Production")');
  const prod = await page.evaluate(() => ({ rows: document.querySelectorAll('.modal table.tbl tr').length, text: document.querySelector('.modal-body')?.textContent || '', goods: [...document.querySelectorAll('.modal table.tbl tr td:first-child')].map((td) => td.textContent) }));
  await page.click('.tab:has-text("Overview")');
  const charts = await page.evaluate(() => document.querySelectorAll('.modal canvas.trend').length);
  check('Production advisor lists goods and bottlenecks; the Overview draws three trend charts', legendGone && prod.rows > 1 && /Bottlenecks/.test(prod.text) && prod.goods.some((t) => /Wheat/.test(t)) && charts === 3, JSON.stringify({ legendGone, rows: prod.rows, charts, goods: prod.goods.slice(0, 8) }));
  // 5a4. The Health, Education and Entertainment advisors open and show their
  //      numbers: a row per kind of building with figures, an advice line,
  //      and staffed counts that match the city; the Overview's health and
  //      crime lines. (A home is still sick from the Disease overlay check.)
  const overviewLines = await page.evaluate(() => document.querySelector('.modal-body').textContent);
  const coverageTabs = [];
  for (const [tab, kinds] of [['Health', ['clinic', 'hospital', 'baths', 'barber']], ['Education', ['school', 'library', 'academy']], ['Entertainment', ['theater', 'amphitheater', 'colosseum', 'actor_troupe', 'gladiator_school', 'menagerie']]]) {
    await page.click(`.tab:has-text("${tab}")`);
    coverageTabs.push(await page.evaluate(({ tab, kinds }) => {
      const g = window.colonia.game;
      const body = document.querySelector('.modal-body');
      const rows = kinds.map((k) => body.querySelector(`tr[data-kind="${k}"]`));
      // The "Staffed" cell of each row: "<staffed> of <built>", as the city has them.
      const staffedOk = rows.every((tr, i) => {
        if (!tr) return false;
        const all = [...g.buildings.values()].filter((b) => b.type === kinds[i]);
        return tr.children[1].textContent === `${all.filter((b) => b.efficiency > 0).length} of ${all.length}`;
      });
      const figures = rows.every((tr) => tr && [...tr.querySelectorAll('td.num')].every((td) => /\d/.test(td.textContent)));
      const advice = body.querySelector('.status.advice')?.textContent || '';
      return { tab, rows: rows.filter(Boolean).length, staffedOk, figures, advice, sick: /Sick homes now/.test(body.textContent) };
    }, { tab, kinds }));
  }
  check('the Health, Education and Entertainment advisors show every kind of building with its numbers and an advice line; the Overview has health and crime lines',
    coverageTabs.every((t) => t.staffedOk && t.figures && t.advice.length > 10) && coverageTabs[0].sick && /City health/.test(overviewLines) && /Crime/.test(overviewLines) && errors.length === 0,
    JSON.stringify({ coverageTabs, errors }));
  if (shots) await page.screenshot({ path: path.join(shots, 'smoke-advisor-entertainment.png') });
  // Clicking a building type's name goes to one of them, with its panel open.
  const named = await page.evaluate(() => {
    const link = document.querySelector('.modal-body tr[data-kind] .linkbtn');
    return link ? link.closest('tr').dataset.kind : null;
  });
  if (named) await page.click('.modal-body tr[data-kind] .linkbtn');
  await page.waitForTimeout(150);
  const shownType = await page.evaluate(() => {
    const app = window.colonia;
    const t = app.ui.info.target;
    const b = t && t.kind === 'building' ? app.game.buildings.get(t.id) : null;
    return { modal: !!document.querySelector('.modal'), type: b ? b.type : null };
  });
  check('clicking a building type in those advisors shows one of them', !!named && !shownType.modal && shownType.type === named, JSON.stringify({ named, shownType }));
  await page.evaluate(() => window.colonia.ui.info.close());
  if (shownType.modal) await page.keyboard.press('Escape'); // the click closed the advisors (Escape on the map opens the game menu)

  // 5a4b. Festivals (sim/religion.js): the Religion advisor's table shows
  //       each size's money, food and wine and what the city has; with no
  //       wine in the warehouses the large and grand festivals are greyed
  //       out with the reason; a small one, clicked, takes its food from the
  //       granaries and the god's last festival reads "this month". The city
  //       is put back as it was, for the steps that follow.
  await page.evaluate(() => window.colonia.ui.openAdvisors('religion'));
  const fest = await page.evaluate(() => {
    const app = window.colonia;
    const g = app.game;
    const c = g.city;
    const gran = [...g.buildings.values()].find((b) => b.def.kind === 'granary');
    if (!gran) return { granary: false };
    const was = { stock: { ...gran.stock }, wine: new Map(), cooldown: c.festivalCooldown, boost: c.festivalBoost, treasury: c.treasury, ceres: { ...c.gods.ceres } };
    for (const b of g.buildings.values()) if (b.def.kind === 'warehouse') { was.wine.set(b.id, b.stock.wine); b.stock.wine = 0; }
    gran.stock.wheat += 800;
    c.festivalCooldown = 0;
    c.treasury = Math.max(c.treasury, 5000);
    // One staffed temple of Ceres for the moment (1 priest; the others idle):
    // her large festival needs 3 priests, and says so.
    const ceresTemples = [...g.buildings.values()].filter((b) => b.def.god === 'ceres').sort((a, b) => (a.def.templeWeight || 1) - (b.def.templeWeight || 1) || a.id - b.id).map((b) => [b, b.efficiency]);
    ceresTemples.forEach(([b], k) => { b.efficiency = k === 0 ? Math.max(b.efficiency, 1) : 0; });
    app.ui.openAdvisors('religion');
    const body = () => document.querySelector('.modal-body');
    const rows = [...body().querySelectorAll('.festivals tr[data-size]')].map((tr) => [...tr.children].map((td) => td.textContent));
    const btn = (size) => body().querySelector(`[data-god="ceres"] button[data-size="${size}"]`);
    const shown = { grandOff: !!btn('grand')?.disabled, largeOff: !!btn('large')?.disabled, smallOn: btn('small') && !btn('small').disabled, title: btn('grand')?.title || '', short: body().querySelector('.festivals [data-short="grand"]')?.textContent || '' };
    shown.largeTitle = btn('large')?.title || '';
    shown.templeNote = body().querySelector('[data-god="ceres"] [data-temples~="large"]')?.textContent || '';
    // (The temples stay as set until after the click: restored first, an unstaffed
    // temple of Ceres in the demo city at this moment had the festival refused.)
    const food = () => { let n = 0; for (const b of g.buildings.values()) if (b.def.kind === 'granary') for (const k in b.stock) n += b.stock[k]; return n; };
    const before = food();
    btn('small').click();
    const after = food();
    const last = body().querySelector('[data-god="ceres"]')?.textContent || '';
    // Festival music for some days after it, not for as long as the mood boost lasts.
    const music = app.musicMood();
    app.festivalDay = null;
    c.festivalBoost = 10;
    const musicLater = app.musicMood();
    for (const [t, eff] of ceresTemples) t.efficiency = eff;
    const out = { granary: true, rows, ...shown, taken: Math.round(before - after), last: /Last festival\s*this month/.test(last), cooldown: c.festivalCooldown, afterOff: !!btn('small')?.disabled, music, musicLater };
    // Back as it was.
    Object.assign(gran.stock, was.stock);
    for (const [id, n] of was.wine) g.buildings.get(id).stock.wine = n;
    Object.assign(c, { festivalCooldown: was.cooldown, festivalBoost: was.boost, treasury: was.treasury });
    Object.assign(c.gods.ceres, was.ceres);
    return out;
  });
  await page.keyboard.press('Escape');
  check('the Religion advisor shows each festival\'s money, food and wine; without wine the large and grand ones are greyed out with the reason; a small one takes its food from the granaries, and festival music follows it for some days',
    fest.granary && fest.rows.length === 3 && fest.rows.every((r) => /\d/.test(r[1]) && /\d/.test(r[2])) && fest.rows[0][3] === '-' && /\d/.test(fest.rows[2][3])
      && fest.grandOff && fest.largeOff && fest.smallOn && /Needs \d+ wine in the warehouses, 0 stored/.test(fest.title) && /Grand: Needs \d+ wine/.test(fest.short)
      && fest.taken >= 100 && fest.last && fest.cooldown === 2 && fest.afterOff && fest.music === 'festival' && fest.musicLater !== 'festival' && errors.length === 0,
    JSON.stringify({ ...fest, errors }));
  check('a festival size the god\'s temples cannot hold is greyed out, with the reason on the button and under it',
    fest.granary && fest.largeOff && /^Needs temples of Ceres with 3 priests .*: 1 at work/.test(fest.largeTitle) && /^Large festival: Needs temples of Ceres with 3 priests .*: 1 at work/.test(fest.templeNote) && errors.length === 0,
    JSON.stringify({ largeTitle: fest.largeTitle, templeNote: fest.templeNote }));

  // 5a4c. Games at the Great Arena (sim/games.js): the console's builder
  //       puts up an Arena (with its schools); its panel shows the Ludi with
  //       their cost and a Hold games button; a click pays for them, the
  //       button greys out with the cooldown, and at the turn of the month
  //       the Overview's mood breakdown lists "Games" at +10. The
  //       Entertainment advisor lists the games and the races.
  const games = await page.evaluate(() => {
    const app = window.colonia;
    const g = app.game;
    const free = g.cheats.freeBuild;
    g.cheats.freeBuild = true;
    const out = { built: app.ui.console.run('arena') };
    g.cheats.freeBuild = free;
    const arena = [...g.buildings.values()].find((b) => b.type === 'colosseum');
    if (!arena) return out;
    // Staffed, with gladiators booked, and money to pay (the console's city may be short of both).
    arena.efficiency = 1;
    arena.shows.colosseum = 20;
    g.city.treasury = Math.max(g.city.treasury, 20000);
    g.city.games.ludi.cooldown = 0;
    app.ui.info.showBuilding(arena.id);
    const panel = () => document.querySelector('#info-panel');
    const btn = () => panel()?.querySelector('button[data-games="ludi"]');
    out.panel = /Ludi \(Games\)/.test(panel()?.textContent || '') && /Every home\s*\+5 while staffed/.test(panel()?.textContent || '');
    out.label = btn()?.textContent || '';
    out.enabled = !!btn() && !btn().disabled;
    const t0 = g.city.treasury;
    btn()?.click();
    out.paid = Math.round(t0 - g.city.treasury);
    out.boost = g.city.games.ludi.boost;
    out.after = { disabled: !!btn()?.disabled, why: panel()?.querySelector('[data-games-why="ludi"]')?.textContent || '' };
    out.message = g.messages.some((m) => /^Ludi at the Arena!/.test(m.text));
    app.ui.info.close();
    // To the turn of the month: the city mood counts the games.
    app.ui.console.run(`days ${16 - g.time.day}`);
    app.ui.openAdvisors('overview');
    const rows = [...document.querySelectorAll('.modal-body .tbl tr')].map((tr) => tr.textContent);
    out.moodRow = rows.find((r) => /^Games/.test(r)) || '';
    app.ui.openAdvisors('entertainment');
    const card = document.querySelector('.modal-body .games');
    out.advisor = { ludi: card?.querySelector('[data-games-kind="ludi"]')?.textContent || '', races: !!card?.querySelector('[data-games-kind="circenses"]') };
    return out;
  });
  await page.keyboard.press('Escape');
  check('games at the Great Arena: held from its panel for their cost, then on a cooldown; the mood breakdown lists them and the Entertainment advisor lists games and races',
    games.panel && /^Hold games \([\d,]+ Dn\)$/.test(games.label) && games.enabled && games.paid > 0 && games.boost === 10 && games.after.disabled && /still talks of the last Ludi/.test(games.after.why) && games.message
      && /^Games \(Ludi at the Arena\)\+10$/.test(games.moodRow) && /Hold games/.test(games.advisor.ludi) && games.advisor.races && errors.length === 0,
    JSON.stringify({ ...games, errors }));

  // 5a5. Auto-pause (ui/autoPause.js): Settings turns on "a fire breaks out";
  //      a fire in the running game then pauses it, with a note that goes
  //      there on a click, outlasts other toasts and leaves when the game
  //      runs again. A fire from the console never pauses; with the switch
  //      off a fire does not either.
  //      Each fire comes on its own: one home's fire risk held over the
  //      threshold until the daily check lights it.
  const pauseWas = await page.evaluate(() => ({ speed: window.colonia.speedIndex, paused: window.colonia.paused, autoPause: window.colonia.settings.autoPause }));
  await page.keyboard.press('Escape'); // the game menu
  await page.click('.modal .btn:has-text("Settings")');
  const switches = await page.evaluate(() => [...document.querySelectorAll('.auto-pause input[data-pause]')].map((i) => `${i.dataset.pause}:${i.checked ? 'on' : 'off'}`));
  await page.click('.auto-pause input[data-pause="fire"]');
  const fireOn = await page.evaluate(() => ({ live: window.colonia.settings.autoPause.fire, stored: JSON.parse(localStorage.getItem('colonia.settings')).autoPause.fire }));
  await page.click('.modal .btn:has-text("Done")');
  check('Settings lists the auto-pause switches (only raiders arriving on at first) and stores the one turned on',
    switches.join(' ') === 'fire:off scouted:off arrive:on caesar:off collapse:off disease:off' && fireOn.live === true && fireOn.stored === true, JSON.stringify({ switches, fireOn }));
  const consoleFire = await page.evaluate(() => {
    const app = window.colonia;
    app.setSpeed(1);
    const before = app.game.city.stats.fires;
    app.ui.console.run('fire');
    return { burned: app.game.city.stats.fires - before, paused: app.paused };
  });
  check('a fire set from the console does not pause the game', consoleFire.burned === 1 && !consoleFire.paused, JSON.stringify(consoleFire));
  /**
   * Hold one occupied home's fire risk over the threshold until it burns;
   * `pick` chooses the home. The fires still burning are put out first: one
   * spreading (no pause, by design) could reach the home before its own
   * fire breaks out, and the check would wait on the wrong fire.
   */
  const lightAHome = (pick) => page.evaluate((k) => {
    const g = window.colonia.game;
    g.fires.clear();
    const homes = [...g.buildings.values()].filter((b) => b.house && b.house.pop > 0 && b.fireRisk > 0).sort((a, b) => a.id - b.id);
    const b = homes[k] || homes[0];
    if (!b) return null;
    window.__torch = { x: b.x, y: b.y, fires: g.city.stats.fires };
    window.colonia.setSpeed(4);
    return { id: b.id, x: b.x, y: b.y };
  }, pick);
  // Followed by its tile, not its id: a home that grows into a larger one
  // (homes merge into a 2x2) is a new building, and the check waited on the
  // gone id until it timed out (CI, v0.18.9).
  const burnt = () => page.waitForFunction(() => {
    const g = window.colonia.game;
    const t = window.__torch;
    const b = g.buildings.get(g.map.buildingAt(t.x, t.y));
    if (b && b.house) b.fireRisk = 1e6; // (a passing prefect would lower it again)
    return !(b && b.house) && g.city.stats.fires > t.fires;
  }, null, { timeout: 30000, polling: 50 }).then(() => true, () => false);
  const torch = await lightAHome(0);
  const lit = torch ? await burnt() : false;
  const paused = await page.evaluate(() => {
    const app = window.colonia;
    const note = document.querySelector('.toast.pause');
    const days = app.game.time.totalDays;
    return { paused: app.paused, note: note ? note.textContent : null, kind: app.game.messages.find((m) => /^Fire!/.test(m.text))?.kind, days };
  });
  await page.waitForTimeout(300);
  const stillDays = await page.evaluate(() => window.colonia.game.time.totalDays);
  check('with the switch on, a fire in the running game pauses it and a note says so',
    lit && paused.paused && paused.kind === 'fire' && /Paused: a fire broke out/.test(paused.note || '') && stillDays === paused.days, JSON.stringify({ torch, lit, paused, stillDays }));
  // Four overlay toasts while paused: the oldest toasts go, the note stays.
  for (let k = 0; k < 4; k++) await page.keyboard.press('o');
  await page.keyboard.press('Shift+O');
  const outlasts = await page.evaluate(() => ({ note: !!document.querySelector('.toast.pause'), toasts: document.querySelectorAll('#messages .toast').length }));
  check('the auto-pause note outlasts newer toasts while the game is paused', outlasts.note && outlasts.toasts <= 4, JSON.stringify(outlasts));
  // The note glides to the fire (the ruin of the home).
  await page.evaluate(() => window.colonia.renderer.camera.centerOnTile(2, 2));
  await page.click('.toast.pause').catch(() => {});
  await page.waitForTimeout(1200);
  const looked = await page.evaluate(() => { const c = window.colonia.renderer.camera; const r = window.colonia.canvas.getBoundingClientRect(); return { at: c.screenToTile(r.width / 2, r.height / 2), paused: window.colonia.paused }; });
  check('clicking the auto-pause note looks at the fire, and the game stays paused', !!torch && Math.abs(looked.at.x - torch.x) <= 2 && Math.abs(looked.at.y - torch.y) <= 2 && looked.paused, JSON.stringify({ torch, looked }));
  // Resume, and a second fire: this time the note is left alone and Space
  // makes it go. Then the switch off: the next fire does not pause.
  await page.keyboard.press('Space');
  const torchB = await lightAHome(1);
  const litB = torchB ? await burnt() : false;
  const pausedB = await page.evaluate(() => ({ paused: window.colonia.paused, notes: document.querySelectorAll('.toast.pause:not(.fade)').length }));
  await page.keyboard.press('Space');
  await page.waitForTimeout(900);
  const resumed = await page.evaluate(() => ({ paused: window.colonia.paused, notes: [...document.querySelectorAll('.toast.pause')].length }));
  check('a second fire pauses again; Space resumes and the note goes', litB && pausedB.paused && pausedB.notes === 1 && !resumed.paused && resumed.notes === 0, JSON.stringify({ torchB, litB, pausedB, resumed }));
  await page.evaluate(() => { const s = window.colonia.settings; s.autoPause = { ...s.autoPause, fire: false }; window.colonia.applySettings(); });
  const torch2 = await lightAHome(2);
  const lit2 = torch2 ? await burnt() : false;
  const offState = await page.evaluate(() => ({ paused: window.colonia.paused, kind: window.colonia.game.messages.find((m) => /^Fire!/.test(m.text))?.kind, notes: document.querySelectorAll('.toast.pause:not(.fade)').length }));
  check('with the switch off a fire does not pause the game',
    lit2 && !offState.paused && offState.kind === 'fire' && offState.notes === 0, JSON.stringify({ torch2, lit2, offState }));
  await page.evaluate((was) => {
    const app = window.colonia;
    app.game.fires.clear(); // put the fires out, so the steps that follow find the city as it was
    app.settings.autoPause = was.autoPause;
    app.applySettings();
    app.setSpeed(was.speed);
    app.paused = true;
  }, pauseWas);

  // 5a5b. Prefects put fires out one building at a time (sim/risk.js): a
  //       home set alight in the running game calls a prefect, who stands
  //       at it throwing water (drawn without errors), and the burning
  //       ruin's panel says it is being put out.
  const douseWas = await page.evaluate(() => ({ speed: window.colonia.speedIndex }));
  const douseErrors = errors.length;
  // The home nearest a staffed prefecture, so a prefect is in reach on any
  // map, and the game stepped tick by tick until one fights it: a douse
  // lasts half a day, which at top speed could start and end between two
  // polls on a slower machine (CI, v0.18.7).
  const torch3 = await page.evaluate(() => {
    const g = window.colonia.game;
    g.fires.clear();
    const posts = [...g.buildings.values()].filter((b) => b.type === 'prefecture' && b.efficiency > 0);
    const dist = (h) => Math.min(...posts.map((p) => Math.abs(p.x - h.x) + Math.abs(p.y - h.y)));
    const homes = [...g.buildings.values()].filter((b) => b.house && b.house.pop > 0).sort((a, b) => dist(a) - dist(b) || a.id - b.id);
    const b = homes[0];
    if (!b || !posts.length) return null;
    window.__torch = { x: b.x, y: b.y, fires: g.city.stats.fires };
    window.colonia.setSpeed(4);
    return { id: b.id, x: b.x, y: b.y, posts: posts.length };
  });
  const lit3 = torch3 ? await burnt() : false;
  const fought = lit3 ? await page.evaluate(() => {
    const app = window.colonia;
    const g = app.game;
    app.paused = true;
    const seen = () => [...g.walkers.values()].find((w) => w.type === 'prefect' && w.state === 'extinguish' && g.fires.has(w.fireTile));
    for (let t = 0; t < 8 * 20 && !seen(); t++) g.runTicks(1); // up to 8 days (20 ticks a day)
    const p = seen();
    if (p) return { id: p.id, tile: p.fireTile };
    // (None came: say what the prefects were doing. This check failed once on a
    // random map with no cause found, v0.20.9: a lead is crews still running to
    // fires the steps before cleared, which count as out.)
    const t0 = window.__torch;
    const posts = [...g.buildings.values()].filter((b) => b.type === 'prefecture').map((b) => ({
      at: [b.x, b.y], eff: b.efficiency, road: b.accessRoad >= 0, crew: (b.walkers || []).map((id) => g.walkers.get(id)).filter(Boolean)
        .map((w) => `${w.state}${w.fireTile !== undefined ? (g.fires.has(w.fireTile) ? ':live' : ':gone') : ''}`),
    }));
    return { none: true, burning: g.fires.size, at: t0 && [t0.x, t0.y], posts, seed: g.seed };
  }) : null;
  let douse = null;
  if (fought && !fought.none) {
    await page.waitForTimeout(200); // a few frames drawn with him at work
    douse = await page.evaluate((f) => {
      const app = window.colonia;
      const { map } = app.game;
      app.ui.info.showTile(map.xOf(f.tile), map.yOf(f.tile));
      const text = document.querySelector('#info-panel')?.textContent || '';
      app.ui.info.close();
      return { text: text.slice(0, 300) };
    }, fought);
  }
  check('a prefect fights a burning building and its panel says "Being put out by a prefect"',
    !!fought && !fought.none && /Being put out by a prefect/.test(douse?.text || '') && errors.length === douseErrors, JSON.stringify({ torch3, lit3, fought, douse, errors: errors.slice(douseErrors, douseErrors + 3) }));
  await page.evaluate((was) => {
    const app = window.colonia;
    app.game.fires.clear();
    app.setSpeed(was.speed);
    app.paused = true;
  }, douseWas);

  // 5a6. Cycling buildings (ui/cycle.js): a panel's arrows (and , and .) go
  //      to the previous / next building of its kind by id; "Next idle" to
  //      the next one of the kind that is not working; I goes through the
  //      idle buildings of every kind; the Production advisor's button too.
  //      The panel's own status line is the judge of "idle" here: red, or
  //      amber for anything but understaffing.
  const cyc = await page.evaluate(() => {
    const app = window.colonia;
    const g = app.game;
    const byType = new Map();
    for (const b of g.buildings.values()) if (!b.house && b.def.workers && !(b.main && b.main !== b.id)) byType.set(b.type, [...(byType.get(b.type) || []), b]);
    const [type, list] = [...byType.entries()].sort((a, b) => b[1].length - a[1].length)[0] || [];
    if (!list || list.length < 3) return null;
    list.sort((a, b) => a.id - b.id);
    // The third one cannot find workers (the game is paused: nothing undoes it).
    list[2].laborAccess = 0;
    list[2].efficiency = 0;
    const idle = list.filter((b) => {
      app.ui.info.showBuilding(b.id);
      const st = document.querySelector('#info-panel .status');
      return st.classList.contains('bad') || (st.classList.contains('warn') && !/^Understaffed/.test(st.textContent));
    }).map((b) => b.id);
    app.ui.info.showBuilding(list[0].id);
    return { type, ids: list.map((b) => b.id), idle };
  });
  const panelId = () => page.evaluate(() => { const t = window.colonia.ui.info.target; return t && t.kind === 'building' && window.colonia.ui.info.open ? t.id : 0; });
  if (cyc) {
    await page.waitForTimeout(100);
    const row = await page.evaluate(() => document.querySelector('#info-panel .cycle-row')?.textContent || '');
    await page.click('#info-panel .cycle-next');
    const viaNext = await panelId();
    await page.keyboard.press(',');
    const viaComma = await panelId();
    await page.keyboard.press('.');
    await page.keyboard.press('.');
    const viaDots = await panelId();
    await page.evaluate((id) => window.colonia.ui.info.showBuilding(id), cyc.ids[0]);
    await page.click('#info-panel .cycle-idle');
    await page.waitForTimeout(1200);
    const viaIdle = await panelId();
    const wantIdle = cyc.idle.find((id) => id > cyc.ids[0]) || cyc.idle[0];
    const glide = await page.evaluate((id) => { const b = window.colonia.game.buildings.get(id); const c = window.colonia.renderer.camera; const r = window.colonia.canvas.getBoundingClientRect(); const t = c.screenToTile(r.width / 2, r.height / 2); return Math.hypot(t.x - b.x, t.y - b.y); }, viaIdle);
    check('a building\'s panel goes to the next and previous of its kind (button, comma and period keys) and to the next idle one, the view gliding there',
      new RegExp(`^◀1 of ${cyc.ids.length}▶Next idle \\(${cyc.idle.length}\\)$`).test(row) && viaNext === cyc.ids[1] && viaComma === cyc.ids[0] && viaDots === cyc.ids[2] && viaIdle === wantIdle && glide < 4,
      JSON.stringify({ cyc, row, viaNext, viaComma, viaDots, viaIdle, wantIdle, glide }));
  } else check('the demo city has three buildings of a kind to cycle through', false);
  // I and the Production advisor: an idle building's panel each time.
  const idleNow = () => page.evaluate(() => {
    const st = document.querySelector('#info-panel:not(.hidden) .status');
    return st ? { id: window.colonia.ui.info.target?.id, idle: st.classList.contains('bad') || (st.classList.contains('warn') && !/^Understaffed/.test(st.textContent)) } : null;
  });
  await page.evaluate(() => window.colonia.ui.info.close());
  await page.keyboard.press('i');
  const viaI = await idleNow();
  await page.keyboard.press('i');
  const viaI2 = await idleNow();
  await page.evaluate(() => window.colonia.ui.info.close());
  await page.keyboard.press('F2');
  await page.click('.tab:has-text("Production")');
  await page.click('.modal .next-idle');
  const viaAdvisor = await idleNow();
  const advisorClosed = await page.evaluate(() => !document.querySelector('.modal'));
  check('I and the Production advisor\'s button open idle buildings\' panels, one after another',
    !!viaI && viaI.idle && !!viaI2 && viaI2.idle && viaI2.id !== viaI.id && !!viaAdvisor && viaAdvisor.idle && advisorClosed && errors.length === 0, JSON.stringify({ viaI, viaI2, viaAdvisor, advisorClosed, errors }));
  await page.evaluate((was) => {
    const app = window.colonia;
    app.ui.info.close();
    app.paused = was.paused;
  }, pauseWas);

  // 5b. Military: garrison, fort panel + deploy by clicking the map, raid alert, advisor
  const gar = await page.evaluate(() => {
    const app = window.colonia;
    app.paused = true;
    const out = app.ui.console.run('garrison');
    app.ui.console.run('days 60');
    const g = app.game;
    const forts = [...g.buildings.values()].filter((b) => b.def.kind === 'fort');
    const soldiers = [...g.units.values()].filter((u) => u.side === 'rome').length;
    const fort = forts.find((f) => [...g.units.values()].some((u) => u.fort === f.id)) || forts[0];
    const bk = [...g.buildings.values()].find((b) => b.type === 'barracks');
    const why = bk ? { eff: bk.efficiency, labor: bk.laborAccess, road: bk.accessRoad, stock: bk.stock, workforce: g.city.workforce, jobs: g.city.jobs, prio: g.city.laborPriority, fortsStaffed: forts.filter((f) => f.efficiency > 0).length } : { barracks: false };
    // Undeployed forts hold their ground: every soldier stands by his fort (its formation reaches 5 tiles from its post).
    const away = [...g.units.values()].filter((u) => u.side === 'rome' && u.fort).filter((u) => {
      const f = g.buildings.get(u.fort);
      return !f || f.rally || Math.hypot(u.x - (f.x + f.size / 2), u.y - (f.y + f.size / 2)) > f.size / 2 + 7;
    });
    // (When one is away, say who and why: his state, target, trip and the nearest foe.
    // This check failed once on a random map with no cause found, v0.20.9.)
    const strayWhy = away.map((u) => {
      const f = g.buildings.get(u.fort);
      const t = u.target ? g.units.get(u.target) : null;
      const foes = [...g.units.values()].filter((o) => o.side !== 'rome' && o.hp > 0);
      const near = foes.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
      return { type: u.type, state: u.state, at: [Math.round(u.x), Math.round(u.y)], fort: f ? [f.type, f.x, f.y, !!f.rally] : null, target: t ? `${t.side}/${t.type}` : null, drill: u.drill || 0, foe: near ? `${near.side}/${near.type} ${Math.round(Math.hypot(near.x - u.x, near.y - u.y))} tiles` : null };
    });
    return { out, forts: forts.length, soldiers, strays: away.length, strayWhy, fortId: fort ? fort.id : 0, fx: fort ? fort.x : 0, fy: fort ? fort.y : 0, why, seed: g.seed };
  });
  check('garrison: forts built and soldiers recruited', gar.forts >= 1 && gar.soldiers >= 1, `${gar.forts} forts, ${gar.soldiers} soldiers; ${gar.out}; ${JSON.stringify(gar.why)}; seed ${gar.seed}`);
  check('garrison: undeployed soldiers stand by their forts', gar.strays === 0, `${gar.strays} of ${gar.soldiers} away from their fort; seed ${gar.seed}; ${JSON.stringify(gar.strayWhy)}`);
  if (gar.fortId) {
    await page.evaluate((id) => { window.colonia.renderer.camera.centerOnTile(window.colonia.game.buildings.get(id).x, window.colonia.game.buildings.get(id).y); window.colonia.ui.info.showBuilding(id); }, gar.fortId);
    await page.click('#info-panel button:has-text("Deploy")');
    check('deploy button enters deploy mode', await page.evaluate(() => window.colonia.deploying > 0));
    // A free tile whose spot on screen shows the map: the first free tile
    // could lie under the open info panel, and the click then hit the panel
    // (seed 905205: no rally point set).
    const target = await page.evaluate(([fx, fy]) => {
      const app = window.colonia;
      const m = app.game.map;
      const cam = app.renderer.camera;
      const rect = app.canvas.getBoundingClientRect();
      const onMap = (x, y) => {
        const wx = (x + 0.5 - (y + 0.5)) * 32;
        const wy = (x + 0.5 + (y + 0.5)) * 16;
        const sx = rect.left + ((wx - cam.x) * cam.scale) / cam.dpr;
        const sy = rect.top + ((wy - cam.y) * cam.scale) / cam.dpr;
        return document.elementFromPoint(sx, sy) === app.canvas;
      };
      for (let r = 5; r < 14; r++) for (const [dx, dy] of [[r, 0], [0, r], [-r, 0], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
        if (m.isFree(fx + dx, fy + dy) && onMap(fx + dx, fy + dy)) return { x: fx + dx, y: fy + dy };
      }
      return null;
    }, [gar.fx, gar.fy]);
    if (target) {
      const p = await toScreen(target.x, target.y);
      await page.mouse.click(p.x, p.y);
      const rally = await page.evaluate((id) => window.colonia.game.buildings.get(id).rally, gar.fortId);
      check('clicking the map deploys the soldiers there', !!rally && Math.floor(rally.x) === target.x && Math.floor(rally.y) === target.y, JSON.stringify(rally));
    } else check('clicking the map deploys the soldiers there', false, 'no free tile on screen near the fort');
    // Never leave deploy mode on for the steps that follow.
    await page.evaluate(() => { if (window.colonia.deploying) window.colonia.cancelDeploy(); });

    // 5b1. Numbered forts: Shift+N picks up fort N's standard, twice glides to it; the
    //      deployed fort's standard is a click target and can be dragged
    //      (sim/fortNumbers.js, input.js), at any view turn.
    // The fort with soldiers (gar.fortId), by its own number: fort I could be one the
    // garrison has not manned yet (a cavalry fort waiting for horses), which rightly
    // has no standard to hand (the check failed so on one random map).
    const far = await page.evaluate((fid) => {
      const app = window.colonia;
      app.ui.info.close();
      const f = app.game.buildings.get(fid);
      if (!f || !f.number || f.number > 9) return null;
      const m = app.game.map;
      // Look away first: the far side of the map from the fort.
      app.renderer.camera.centerOnTile(f.x < m.w / 2 ? m.w - 12 : 12, f.y < m.h / 2 ? m.h - 12 : 12);
      return { id: f.id, x: f.x + 1, y: f.y + 1, n: f.number, roman: ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][f.number] };
    }, gar.fortId);
    const key = `Shift+Digit${far ? far.n : 1}`;
    await page.mouse.move(400, 300); // (the pointer over the map, not a button the press could land on)
    // One press: fort N's standard in hand where the view is, its panel open, the view still.
    const camBefore = await page.evaluate(() => ({ x: window.colonia.renderer.camera.x, y: window.colonia.renderer.camera.y }));
    await page.keyboard.press(key);
    await page.waitForTimeout(600);
    const picked = await page.evaluate((c) => {
      const app = window.colonia;
      const cam = app.renderer.camera;
      return { deploying: app.deploying, target: app.ui.info.target, still: Math.abs(cam.x - c.x) < 1 && Math.abs(cam.y - c.y) < 1 };
    }, camBefore);
    check('Shift+N picks up the standard of fort N where the view is (its panel open, the view still)', !!far && picked.deploying === far.id && picked.target?.id === far.id && picked.still, JSON.stringify({ far, picked }));
    // Twice quickly: the view glides to the fort (and the standard is put down).
    await page.keyboard.press(key);
    await page.keyboard.press(key);
    await page.waitForTimeout(1500); // the glide
    const one = await page.evaluate((f) => {
      const app = window.colonia;
      const r = app.canvas.getBoundingClientRect();
      const cam = app.renderer.camera;
      const at = cam.screenToTile(r.width / 2, r.height / 2);
      // The fort in the middle of the view (a fort by the map's edge sits off
      // center: the camera stops at the edge).
      const w = f ? app.renderer.worldAt(f.x + 0.5, f.y + 0.5) : { x: 0, y: 0 };
      const sx = ((w.x - cam.x) * cam.scale) / cam.dpr / r.width;
      const sy = ((w.y - cam.y) * cam.scale) / cam.dpr / r.height;
      return { at, mid: sx > 0.2 && sx < 0.8 && sy > 0.2 && sy < 0.8, target: app.ui.info.target, head: document.querySelector('#info-panel h3')?.textContent || '', text: document.getElementById('info-panel').textContent };
    }, far);
    check('Shift+N twice quickly glides to fort N, its panel titled with its number and key', !!far && one.target?.id === far.id && one.mid && one.head.includes(` ${far.roman} (`) && one.text.includes(`Shift+${far.n}`), JSON.stringify({ far, at: one.at, mid: one.mid, target: one.target, head: one.head }));

    /** CSS px of the middle of a rally flag's cloth, from where the renderer drew it, or null. */
    const flagPoint = (id) => page.evaluate((fid) => {
      const app = window.colonia;
      const r = app.renderer;
      const s = r.flagSpots.find((o) => o.id === fid);
      if (!s) return null;
      const cam = r.camera;
      const rect = app.canvas.getBoundingClientRect();
      return { x: rect.left + ((s.wx + 4 - cam.x) * cam.scale) / cam.dpr, y: rect.top + ((s.wy - 20 - cam.y) * cam.scale) / cam.dpr };
    }, id);
    /** A tile `r0` or more tiles from the fort's flag whose spot on screen shows the map, in CSS px. */
    const openTileNear = (id, r0) => page.evaluate(([fid, rmin]) => {
      const app = window.colonia;
      const f = app.game.buildings.get(fid);
      const m = app.game.map;
      const cam = app.renderer.camera;
      const rect = app.canvas.getBoundingClientRect();
      const fx = Math.floor(f.rally.x);
      const fy = Math.floor(f.rally.y);
      for (let r = rmin; r < rmin + 6; r++) for (const [dx, dy] of [[r, 0], [0, r], [-r, 0], [0, -r], [r, r], [-r, -r]]) {
        const x = fx + dx;
        const y = fy + dy;
        if (!m.inBounds(x, y)) continue;
        const w = app.renderer.worldAt(x + 0.5, y + 0.5); // (the view turn's own projection)
        const sx = rect.left + ((w.x - cam.x) * cam.scale) / cam.dpr;
        const sy = rect.top + ((w.y - cam.y) * cam.scale) / cam.dpr;
        if (document.elementFromPoint(sx, sy) === app.canvas) return { x, y, sx, sy };
      }
      return null;
    }, [id, r0]);
    const lookAtFlag = (id) => page.evaluate((fid) => {
      const app = window.colonia;
      const f = app.game.buildings.get(fid);
      app.ui.info.close();
      app.renderer.camera.centerOnTile(Math.floor(f.rally.x), Math.floor(f.rally.y));
    }, id);
    const rallyOf = (id) => page.evaluate((fid) => window.colonia.game.buildings.get(fid).rally, id);
    const camAt = () => page.evaluate(() => ({ x: window.colonia.renderer.camera.x, y: window.colonia.renderer.camera.y }));

    if (await rallyOf(gar.fortId)) {
      await lookAtFlag(gar.fortId);
      await page.waitForTimeout(200);
      const fp = await flagPoint(gar.fortId);
      if (fp) await page.mouse.click(fp.x, fp.y);
      await page.waitForTimeout(100);
      const clicked = await page.evaluate(() => ({ target: window.colonia.ui.info.target, recall: [...document.querySelectorAll('#info-panel button')].some((b) => /Recall/.test(b.textContent) && !b.disabled) }));
      check('clicking a deployed fort\'s standard opens the fort, with Recall', !!fp && clicked.target?.kind === 'building' && clicked.target.id === gar.fortId && clicked.recall, JSON.stringify({ fp, clicked }));

      // Drag the standard to a tile a few tiles off: the soldiers' rally moves there, and the map does not pan.
      await lookAtFlag(gar.fortId);
      await page.waitForTimeout(200);
      const from = await flagPoint(gar.fortId);
      const to = await openTileNear(gar.fortId, 4);
      const cam0 = await camAt();
      if (from && to) {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.sx, to.sy, { steps: 8 });
        const mid = await page.evaluate(() => window.colonia.renderer.flagDrag);
        await page.mouse.up();
        const rally = await rallyOf(gar.fortId);
        const cam1 = await camAt();
        check('dragging a standard redeploys the fort where it is dropped, without panning the map', !!rally && Math.floor(rally.x) === to.x && Math.floor(rally.y) === to.y && mid && mid.x === to.x && mid.y === to.y && cam0.x === cam1.x && cam0.y === cam1.y, JSON.stringify({ to, rally, mid, cam0, cam1 }));
      } else check('dragging a standard redeploys the fort where it is dropped, without panning the map', false, JSON.stringify({ from, to }));

      // Dropped on a panel (not on the map): the standard stays where it was.
      await page.evaluate((id) => window.colonia.ui.info.showBuilding(id), gar.fortId);
      await page.waitForTimeout(100);
      const before = await rallyOf(gar.fortId);
      const from2 = await flagPoint(gar.fortId);
      // (Its title: plain text, no button a stray click could press.)
      const panelAt = await page.evaluate(() => { const r = document.querySelector('#info-panel h3').getBoundingClientRect(); return { x: r.left + Math.min(40, r.width / 2), y: r.top + r.height / 2 }; });
      if (from2) {
        await page.mouse.move(from2.x, from2.y);
        await page.mouse.down();
        await page.mouse.move(panelAt.x, panelAt.y, { steps: 8 });
      }
      const held = await page.evaluate(() => window.colonia.renderer.flagDrag); // (the drag really started: no ghost over the panel)
      if (from2) await page.mouse.up();
      const after = await rallyOf(gar.fortId);
      check('a standard dropped on a panel, off the map, stays where it was', !!from2 && !!held && held.x === -1 && JSON.stringify(after) === JSON.stringify(before), JSON.stringify({ from2, held, before, after }));

      // A turned view: the standard is found and dragged by the turned projection.
      await page.evaluate(() => window.colonia.turnView(1));
      await lookAtFlag(gar.fortId);
      await page.waitForTimeout(200);
      const from3 = await flagPoint(gar.fortId);
      const to3 = await openTileNear(gar.fortId, 3);
      if (from3 && to3) {
        await page.mouse.move(from3.x, from3.y);
        await page.mouse.down();
        await page.mouse.move(to3.sx, to3.sy, { steps: 8 });
        await page.mouse.up();
      }
      const rally3 = await rallyOf(gar.fortId);
      const turn = await page.evaluate(() => window.colonia.renderer.viewTurn);
      check('at a turned view a standard is still grabbed and dropped on the tile under the pointer', turn === 1 && !!to3 && !!rally3 && Math.floor(rally3.x) === to3.x && Math.floor(rally3.y) === to3.y, JSON.stringify({ turn, from3, to3, rally3 }));
      await page.evaluate(() => window.colonia.turnView(-window.colonia.renderer.viewTurn));
    } else check('clicking a deployed fort\'s standard opens the fort, with Recall', false, 'the fort was not deployed');
    await page.evaluate(() => window.colonia.ui.info.close());
  }
  // 5b2. The Empire map: E opens it and it draws (a scouted warband and a
  //      caravan on the way included), clicking the warband closes it and
  //      looks at the map edge it will enter by, Escape closes it.
  await page.evaluate(() => {
    const app = window.colonia;
    const g = app.game;
    const r0 = g.city.trade.routes.tarraco;
    window.__empireSaved = { warned: g.military.warned, next: g.military.nextRaidMonth, open: r0.open, visit: r0.nextVisit, paused: app.paused };
    app.paused = true; // hold the timers still while the test reads them
    // The middle of the x = 0 edge, which is north-west on screen (as the sim's scouts name it).
    g.military.warned = { origin: { x: 0, y: Math.floor(g.map.h / 2) }, size: 14, dir: 'north-west' };
    g.military.nextRaidMonth = g.time.totalMonths + 2;
    const r = g.city.trade.routes.tarraco;
    r.open = true;
    r.nextVisit = g.time.totalDays + 5;
  });
  await page.keyboard.press('e');
  await page.waitForSelector('canvas.empire-full', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(200);
  const empire = await page.evaluate(() => {
    const c = document.querySelector('canvas.empire-full');
    if (!c) return null;
    // Not blank: the parchment, the sea, the routes and figures give many colors.
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const colors = new Set();
    for (let i = 0; i < d.length; i += 4 * 37) colors.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4},${d[i + 3] >> 6}`);
    const ui = window.colonia.ui;
    return {
      kind: ui.modalKind, w: c.width, h: c.height, colors: colors.size,
      list: [...document.querySelectorAll('.empire-side .empire-row')].map((e) => e.textContent).filter((t) => /days|month/.test(t)),
      hudBtn: !!document.getElementById('hud-empire'),
    };
  });
  check('E opens the empire map and it draws', !!empire && empire.kind === 'empire' && empire.w > 300 && empire.colors > 12 && empire.hudBtn, JSON.stringify(empire && { ...empire, list: undefined }));
  check('the empire map lists the caravan and the warband with their time left', !!empire && empire.list.some((t) => /Tarraco caravan: 5 days/.test(t)) && empire.list.some((t) => /Warband of 14 from the north-west, in 2 months/.test(t)), JSON.stringify(empire && empire.list));
  // Hovering the warband reads it out; clicking it pans the city view to its edge.
  const band = await page.evaluate(() => {
    const view = window.colonia.ui.empire;
    const t = view.travelers.find((o) => o.kind === 'warband');
    return t ? view.clientPoint(t) : null;
  });
  if (band) {
    await page.mouse.move(band.x, band.y);
    await page.waitForTimeout(100);
    const readout = await page.textContent('.empire-readout');
    check('pointing at the warband reads it out', /Warband of 14 from the north-west, in 2 months/.test(readout), readout);
    // From the map's middle: on a random map the view could start within 3 tiles
    // of that edge, where the camera's bounds leave no room to move toward it.
    const before = await page.evaluate(() => {
      const app = window.colonia;
      const c = app.renderer.camera;
      c.centerOnTile(app.game.map.w / 2, app.game.map.h / 2);
      const r = app.canvas.getBoundingClientRect();
      return c.screenToTile(r.width / 2, r.height / 2);
    });
    await page.mouse.click(band.x, band.y);
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => { const c = window.colonia.renderer.camera; const r = window.colonia.canvas.getBoundingClientRect(); return { kind: window.colonia.ui.modalKind, at: c.screenToTile(r.width / 2, r.height / 2) }; });
    // Its edge is x = 0 in tile terms: the view moved toward it.
    check('clicking the warband closes the map and looks at its map edge', after.kind === null && after.at.x < before.x - 3, JSON.stringify({ before, after }));
  } else {
    check('the scouted warband is on the empire map', false);
  }
  await page.click('#hud-empire');
  await page.waitForTimeout(150);
  const viaButton = await page.evaluate(() => window.colonia.ui.modalKind);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const closed = await page.evaluate(() => ({ kind: window.colonia.ui.modalKind, canvas: !!document.querySelector('canvas.empire-full') }));
  check('the top-bar compass opens the empire map and Escape closes it', viaButton === 'empire' && closed.kind === null && !closed.canvas, JSON.stringify({ viaButton, closed }));
  // News of a warband on its way (the staged warnings, sim/military.js):
  // clicking the toast opens the empire map with the warband picked out.
  await page.evaluate(() => window.colonia.game.message('Smoke: word of a warband.', 'warn', undefined, undefined, { empire: 'warband' }));
  await page.click('.toast:has-text("Smoke: word of a warband.")').catch(() => {});
  await page.waitForTimeout(150);
  const viaToast = await page.evaluate(() => { const ui = window.colonia.ui; return { kind: ui.modalKind, picked: ui.empire.hover?.t?.kind || null }; });
  check('a warning about a warband opens the empire map on it', viaToast.kind === 'empire' && viaToast.picked === 'warband', JSON.stringify(viaToast));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const g = window.colonia.game;
    const was = window.__empireSaved; // put the raid schedule and the route back as they were
    g.military.warned = was.warned;
    g.military.nextRaidMonth = was.next;
    g.city.trade.routes.tarraco.open = was.open;
    g.city.trade.routes.tarraco.nextVisit = was.visit;
    window.colonia.paused = was.paused;
  });

  await page.evaluate(() => window.colonia.ui.console.run('invade 4'));
  await page.waitForTimeout(600);
  const threat = await page.evaluate(() => { const el = document.querySelector('.hud-btn.threat'); return el ? { hidden: el.classList.contains('hidden'), text: el.textContent } : null; });
  check('raid alert shows in the top bar', !!threat && !threat.hidden && threat.text.includes('⚔'), JSON.stringify(threat));
  await page.keyboard.press('F2');
  await page.click('.tab:has-text("Military")');
  check('military advisor lists forts', await page.isVisible('.modal th:has-text("Fort")'));
  await page.click('.tab:has-text("Trade")');
  check('trade advisor draws the empire map', await page.isVisible('canvas.empire-map'));
  await page.keyboard.press('Escape');

  // 5b3. Caesar's call for troops: the Imperial advisor switches the forts
  //      to Empire service and sends them (after its own confirmation).
  //      Then his legions: the top bar and the empire map name them. Then
  //      an arch earned goes across a road.
  await page.evaluate(() => window.colonia.ui.console.run('battle placentia 8'));
  await page.keyboard.press('F2');
  await page.click('.tab:has-text("Imperial")');
  const callText = await page.textContent('.battle-card');
  await page.evaluate(() => {
    // Every fort on: each click redraws the card, so find the buttons afresh.
    for (let k = 0; k < 12; k++) {
      const off = [...document.querySelectorAll('.battle-card .service-btn')].find((b) => !b.classList.contains('active'));
      if (!off) break;
      off.click();
    }
  });
  await page.click('.battle-card .send-troops');
  await page.click('.modal-foot .btn:has-text("Send them")');
  await page.waitForTimeout(200);
  const sent = await page.evaluate(() => {
    const g = window.colonia.game;
    const b = g.military.battle;
    return { sent: !!(b && b.sent), gone: b && b.sent ? b.sent.men.length : 0, onMap: [...g.units.values()].filter((u) => u.away).length, strength: b && b.sent ? b.sent.strength : 0, kind: window.colonia.ui.modalKind, card: document.querySelector('.battle-card')?.textContent || '' };
  });
  check('the Imperial advisor shows Caesar\'s call for troops and sends the forts switched to Empire service', /Placentia/.test(callText) && sent.sent && sent.gone > 0 && sent.onMap === 0 && sent.strength > 0 && sent.kind === 'advisors' && /strength/.test(sent.card) && errors.length === 0, JSON.stringify({ call: callText.slice(0, 90), ...sent, card: sent.card.slice(0, 120) }));
  // The recall: they left the province the moment they were sent, so a rider goes after one fort's men (they still count until he reaches them).
  const recall = await page.evaluate(() => {
    const g = window.colonia.game;
    window.colonia.ui.openAdvisors('imperial');
    const btn = document.querySelector('.battle-card .recall-battle');
    if (!btn) return { btn: false };
    btn.click();
    return { btn: true, riders: (g.military.recalls || []).map((r) => r.rider), card: document.querySelector('.battle-card')?.textContent || '' };
  });
  check('the Imperial advisor recalls the men of a fort from the road: a rider goes after them', recall.btn && recall.riders.length === 1 && recall.riders[0] >= 1 && /A rider carries your recall/.test(recall.card) && errors.length === 0, JSON.stringify({ ...recall, card: (recall.card || '').slice(0, 160) }));
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.colonia.ui.console.run('legion now 3'));
  await page.waitForTimeout(400);
  const legionHud = await page.evaluate(() => { const el = document.querySelector('.hud-btn.threat'); return el ? { hidden: el.classList.contains('hidden'), text: el.textContent, title: el.title } : null; });
  await page.keyboard.press('e');
  await page.waitForSelector('canvas.empire-full', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  const legionRows = await page.evaluate(() => [...document.querySelectorAll('.empire-side .empire-row')].map((e) => e.textContent));
  check('Caesar\'s legions arrive: the top bar names them, and the empire map shows them with the troops on their way', !!legionHud && !legionHud.hidden && /Caesar's legionaries/.test(legionHud.title)
    && legionRows.some((t) => /Caesar's legions in the province: 3 left/.test(t)) && legionRows.some((t) => /Your troops \(strength \d+\) on the way to Placentia/.test(t)), JSON.stringify({ legionHud, legionRows }));
  check('the empire map shows the rider of a recall riding after the troops', legionRows.some((t) => /A rider carrying your recall to the troops of the/.test(t)), JSON.stringify(legionRows));
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    // Caesar's men gone again (as if destroyed), so the steps that follow see the city as it was.
    const g = window.colonia.game;
    for (const u of [...g.units.values()]) if (u.legion) g.units.delete(u.id);
    g.military.caesar.army = null;
  });
  const archAt = await page.evaluate(() => {
    const app = window.colonia;
    const m = app.game.map;
    app.ui.console.run('arch');
    // By now this city is often in debt (-150 to -300 Dn around day 140,
    // more or less as the steps before ran fast or slow), and the road
    // dragged under the arch failed for want of money: this step is about
    // the arch, so the treasury is topped up first.
    if (app.game.city.treasury < 2000) app.ui.console.run(`money ${Math.ceil(2000 - app.game.city.treasury)}`);
    // A 5 x 3 patch of open land near the middle: a road along its middle row, the arch over it.
    const c = { x: Math.floor(m.w / 2), y: Math.floor(m.h / 2) };
    for (let r = 0; r < 30; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = c.x + dx;
          const y = c.y + dy;
          let ok = true;
          for (let j = -1; j <= 1 && ok; j++) for (let i = -1; i <= 5 && ok; i++) if (!m.isFree(x + i, y + j) || m.terrain[m.idx(x + i, y + j)] === 2) ok = false;
          if (ok) { app.renderer.camera.centerOnTile(x + 2, y); return { x, y }; }
        }
      }
    }
    return null;
  });
  let archPlaced = null;
  let archListed = false;
  let archTool = null;
  let archHover = null;
  if (archAt) {
    await page.waitForTimeout(150);
    await page.keyboard.press('r');
    const a = await toScreen(archAt.x, archAt.y);
    const b = await toScreen(archAt.x + 4, archAt.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.press('Escape');
    // (Another category first: a second click on the open one folds its list away.)
    await page.click('.cat-btn[title^="Roads"]');
    await page.click('.cat-btn[title^="Government"]');
    archListed = await page.isVisible('.build-item[data-key="triumphal_arch"]');
    if (archListed) {
      // Pointing at it fills the box under the list with its description.
      // That box used to grow with the text and shrink the list from below,
      // so the arch (the list's last item, scrolled to the bottom) slid
      // under the box while the pointer stayed put, and the click went to
      // the box: no tool. Point near its lower edge, as a player might, and
      // the arch must still be what is under the pointer.
      const arch = await page.evaluate(() => { const el = document.querySelector('.build-item[data-key="triumphal_arch"]'); el.scrollIntoView({ block: 'end' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - 3, top: Math.round(r.top) }; });
      await page.mouse.move(arch.x, arch.y);
      await page.waitForTimeout(150);
      archHover = await page.evaluate((a) => { const e = document.elementFromPoint(a.x, a.y); return { under: e?.closest('[data-key]')?.dataset.key || e?.closest('[id]')?.id || null, top: Math.round(document.querySelector('.build-item[data-key="triumphal_arch"]').getBoundingClientRect().top), was: a.top, info: document.querySelector('#tool-info h4')?.textContent }; }, arch);
      await page.mouse.click(arch.x, arch.y);
    }
    const p = await toScreen(archAt.x + 2, archAt.y);
    await page.mouse.move(p.x - 4, p.y);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(100);
    archTool = await page.evaluate(() => { const r = window.colonia.renderer; return { tool: window.colonia.input.tool, plan: r.plan ? { reason: r.plan.reason, count: r.plan.count, at: r.plan.items[0] && [r.plan.items[0].x, r.plan.items[0].y] } : null }; });
    await page.mouse.click(p.x, p.y);
    if (await page.evaluate(() => window.colonia.input.tool)) await page.keyboard.press('Escape');
    await page.waitForTimeout(250); // (the build menu notices on its next frame)
    archPlaced = await page.evaluate(({ x, y }) => {
      const g = window.colonia.game;
      const b = [...g.buildings.values()].find((o) => o.type === 'triumphal_arch');
      return b ? { x: b.x, y: b.y, axis: b.axis, road: g.map.road[g.map.idx(x + 2, y)], listed: !!document.querySelector('.build-item[data-key="triumphal_arch"]') } : null;
    }, archAt);
  }
  // On failure: the road under the patch and the arch's plan there.
  const archWhy = archPlaced ? null : await page.evaluate((s) => {
    if (!s) return null;
    const app = window.colonia;
    const m = app.game.map;
    const rows = [-1, 0, 1].map((j) => [-1, 0, 1, 2, 3, 4, 5].map((i) => m.road[m.idx(s.x + i, s.y + j)]).join(''));
    return { rows, tool: app.input.tool, earned: app.game.city.archesEarned, modal: app.ui.modalKind, toasts: [...document.querySelectorAll('.toast')].slice(0, 3).map((e) => e.textContent) };
  }, archAt);
  check('pointing at the last build item shows it in the box below the list, and it stays under the pointer for the click', !!archHover && archHover.under === 'triumphal_arch' && archHover.top === archHover.was && /^Fornix/.test(archHover.info || ''), JSON.stringify(archHover));
  check('an arch earned is in the build menu and goes across a road, which runs on under it; then it leaves the menu', archListed && !!archPlaced && archPlaced.x === archAt.x + 1 && archPlaced.y === archAt.y - 1 && archPlaced.axis === 0 && archPlaced.road === 1 && !archPlaced.listed && errors.length === 0, JSON.stringify({ archAt, archListed, archTool, archPlaced, archWhy }));

  // 5c. The world around the city: smooth zoom, night lights, weather, settings.
  await page.evaluate(() => { window.colonia.renderer.camera.zoomIndex = 2; });
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(600);
  const zoomed = await page.evaluate(() => { const c = window.colonia.renderer.camera; return { zoom: c.zoom, target: c.targetZoom, moving: c.moving }; });
  check('mouse wheel eases to the next zoom level', zoomed.zoom === zoomed.target && zoomed.target > 1 && !zoomed.moving, JSON.stringify(zoomed));
  await page.evaluate(() => { window.colonia.renderer.camera.zoomIndex = 2; window.colonia.renderer.fixedTime = 0.8; });
  await page.waitForTimeout(250);
  const lights = await page.evaluate(() => window.colonia.renderer.stats.lights);
  check('at night homes and torches light up', lights > 0, `${lights} lights`);
  await page.evaluate(() => { window.colonia.renderer.fixedTime = null; window.colonia.ui.console.run('weather rain'); });
  check('console can change the weather', await page.evaluate(() => window.colonia.renderer.weather.kind === (window.colonia.renderer.pal.season === 'winter' ? 'snow' : 'rain')));
  // Seasons: the date chip names the season, and in winter rain falls as snow.
  const winter = await page.evaluate(() => {
    const app = window.colonia;
    const month = app.game.time.month;
    app.game.time.month = 0; // Ianuarius
    app.renderer.render(0, 0.016); // the renderer picks up the season
    app.ui.hud.update();
    const chip = document.querySelector('#hud-top .hud-stat.date');
    const out = { text: chip.textContent, title: chip.title, reply: app.ui.console.run('weather rain'), kind: app.renderer.weather.kind };
    app.renderer.render(0, 0.016);
    app.ui.hud.update();
    out.after = chip.title; // the tooltip names the (fitted) weather
    app.game.time.month = month;
    return out;
  });
  // The season's name only shows while the top bar has room for it.
  const fit = await page.evaluate(() => {
    const app = window.colonia;
    const c = app.game.city;
    const keep = { name: c.name, treasury: c.treasury, population: c.population };
    Object.assign(c, { name: 'Portus Mercatorum Magnus', treasury: 1234567, population: 23456 });
    app.ui.hud.update();
    const bar = document.getElementById('hud-top');
    const out = { hidden: bar.classList.contains('no-season'), over: bar.scrollWidth - bar.clientWidth };
    Object.assign(c, keep);
    app.ui.hud.update();
    // Shown again unless the bar is full even so (a raid's chip, still on
    // from the legions above while they fight on in real time, can fill
    // it): measured with the season shown, as fitSeason() measures it.
    const hid = bar.classList.contains('no-season');
    const steps = ['no-season', 'tight', 'tighter'].filter((k) => bar.classList.contains(k));
    bar.classList.remove(...steps); // (measured with every fitting step undone)
    out.fullAfter = bar.scrollWidth > bar.clientWidth;
    bar.classList.add(...steps);
    out.shownAfter = !hid || out.fullAfter;
    return out;
  });
  // Unemployment sits beside the mood, amber once it costs mood.
  const workChip = await page.evaluate(() => {
    const app = window.colonia;
    const c = app.game.city;
    const keep = c.unemploymentRate;
    c.unemploymentRate = 0.3;
    app.ui.hud.update();
    const el = [...document.querySelectorAll('#hud-top .hud-stat')].find((e) => e.textContent.includes('⚒'));
    const out = { text: el && el.textContent, warn: !!el && el.classList.contains('warn'), title: el && el.title };
    c.unemploymentRate = keep;
    app.ui.hud.update();
    out.calm = !!el && !el.classList.contains('warn') === keep <= 0.1;
    return out;
  });
  check('the top bar shows unemployment, amber when it costs mood', /30%/.test(workChip.text || '') && workChip.warn && /lowers the city mood/.test(workChip.title || '') && workChip.calm, JSON.stringify(workChip));
  check('the season name gives way when the top bar is full',(fit.hidden || fit.over <= 0) && fit.shownAfter, JSON.stringify(fit));
  check('the top bar shows the season; winter only snows', winter.text.includes('Winter') && winter.title.includes('winter') && winter.kind === 'snow' && /not possible in winter/.test(winter.reply) && /snow/.test(winter.after), JSON.stringify(winter));
  // Snow settles: the ground, trees and roofs turn white (baked into the
  // sprites, so the new look is prepared, then swapped in whole).
  const snowy = await page.evaluate(() => {
    const app = window.colonia;
    const r = app.renderer;
    const month = app.game.time.month;
    app.game.time.month = 0;
    const home = [...app.game.buildings.values()].find((b) => b.def.kind === 'house');
    if (home) r.camera.centerOnTile(home.x, home.y); // some roofs in view
    app.ui.console.run('weather snow');
    const reply = app.ui.console.run('snow 3');
    let frames = 0;
    do { r.render(0, 0.016); frames++; } while ((r.palPrev !== null || r.snowPrev !== null) && frames < 60);
    const keys = [...r.sprites.current.keys()];
    const out = { reply, key: r.pal.key, frames, pending: r.stats.pending, snowSprites: keys.filter((k) => /~(p\d+)?n3$/.test(k)).length, buildings: keys.filter((k) => k.startsWith('b:') && k.endsWith('~n3')).length };
    app.game.time.month = month;
    return out;
  });
  // The new look is prepared a slice of time each frame, so a slower machine
  // needs more frames: 30 was enough until the new buildings' snowy art came
  // in (277 sprites; 37 frames at a 4x slower CPU, which failed CI). What
  // matters is that it swaps in whole, within about a second and a half.
  check('snow cover whitens ground, trees and roofs; the new look swaps in within 90 frames', /n3$/.test(snowy.key) && snowy.frames <= 90 && snowy.pending === 0 && snowy.snowSprites > 0 && snowy.buildings > 0, JSON.stringify(snowy));
  // Snow levels arriving a few frames apart (0 -> 1 -> 2, and a flip back):
  // every frame draws the ground in a single look, and the change completes.
  // (Only ground: a tree's sway frame never drawn in the old look has no
  // stand-in and is made in the new look at once.)
  const overlap = await page.evaluate(() => {
    const app = window.colonia;
    const r = app.renderer;
    const month = app.game.time.month;
    app.game.time.month = 0;
    app.ui.console.run('snow 0');
    for (let i = 0; i < 80 && (r.palPrev !== null || r.snowPrev !== null || i < 2); i++) r.render(0, 0.016);
    const get = r.sprites.get;
    let looks = {};
    r.sprites.get = function (key, spec, fb) {
      const spr = get.call(this, key, spec, fb);
      const m = /^g.*~(p\d+(?:n\d)?)$/.exec(key);
      if (m) {
        const old = fb !== null && fb !== undefined ? this.current.get(fb) || this.borrow(fb) : null;
        const look = old && spr === old ? /~(p\d+(?:n\d)?)$/.exec(fb)[1] : m[1];
        looks[look] = (looks[look] || 0) + 1;
      }
      return spr;
    };
    const frames = [];
    const frame = () => { looks = {}; r.render(0, 0.016); frames.push(looks); };
    try {
      app.ui.console.run('snow 1'); frame(); frame();
      app.ui.console.run('snow 2'); frame(); frame();
      app.ui.console.run('snow 1'); frame();
      for (let i = 0; i < 80 && (r.palPrev !== null || r.snowPrev !== null); i++) frame();
    } finally {
      r.sprites.get = get;
      app.game.time.month = month;
    }
    const mixed = frames.filter((f) => Object.keys(f).length > 1);
    return { mixed: mixed.length, example: mixed[0], frames: frames.length, done: r.palPrev === null && r.snowPrev === null, key: r.pal.key };
  });
  check('overlapping snow changes never mix two looks in one frame, and finish', overlap.mixed === 0 && overlap.done && /n1$/.test(overlap.key), JSON.stringify(overlap));
  // Reduced motion: no falling flakes, but the snow on the ground still shows.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const still = await page.evaluate(() => {
    const app = window.colonia;
    const r = app.renderer;
    const month = app.game.time.month;
    app.game.time.month = 0;
    app.applySettings();
    r.weather.flakes.length = 0;
    r.weather.force('snow', true);
    for (let i = 0; i < 5; i++) r.render(0, 0.016);
    const out = { motion: r.motionOn, flakes: r.weather.flakes.length, key: r.pal.key };
    app.game.time.month = month;
    return out;
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.colonia.applySettings());
  check('reduced motion: no falling snow, snow on the ground still shows', !still.motion && still.flakes === 0 && /n\d$/.test(still.key), JSON.stringify(still));
  // Weather off: the snow is gone, and so are its sprites.
  const bare = await page.evaluate(() => {
    const app = window.colonia;
    const r = app.renderer;
    const month = app.game.time.month;
    app.game.time.month = 0;
    app.settings.weather = false;
    app.applySettings();
    let frames = 0;
    do { r.render(0, 0.016); frames++; } while ((r.palPrev !== null || r.snowPrev !== null) && frames < 60);
    const left = [...r.sprites.byScale.values()].flatMap((m) => [...m.keys()]).filter((k) => /~(p\d+)?n\d$/.test(k)).length;
    const out = { key: r.pal.key, cover: r.weather.cover, left, frames };
    app.settings.weather = true;
    app.applySettings();
    app.game.time.month = month;
    return out;
  });
  check('weather off clears the snow and its sprites', bare.key === 'p0' && bare.cover === 0 && bare.left === 0, JSON.stringify(bare));
  await page.evaluate(() => window.colonia.renderer.weather.force('clear', true));
  await page.evaluate(() => window.colonia.ui.info.close()); // (Escape would close this first)
  await page.keyboard.press('Escape'); // pause menu
  await page.click('.modal button:has-text("Settings")');
  const worldToggles = await page.isVisible('text=Day and night') && await page.isVisible('text=Seasons') && await page.isVisible('text=Weather: clouds');
  await page.click('label:has-text("Day and night") input');
  const dayOff = await page.evaluate(() => window.colonia.renderer.dayNightOn === false && window.colonia.settings.dayNight === false);
  await page.click('label:has-text("Day and night") input');
  const dayOn = await page.evaluate(() => window.colonia.renderer.dayNightOn === true);
  check('settings switch day/night, seasons and weather', worldToggles && dayOff && dayOn, JSON.stringify({ worldToggles, dayOff, dayOn }));
  // Every settings checkbox sits on the first line of its own label, even
  // with a long help text below it (it used to wrap onto a line of its own).
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.modal .check-row')].map((row) => {
    const box = row.querySelector('input').getBoundingClientRect();
    const text = row.querySelector('span').getBoundingClientRect();
    return { label: row.textContent.slice(0, 24), beside: box.right <= text.left + 1, sameLine: box.top >= text.top - 6 && box.top <= text.top + 10 };
  }));
  check('each settings checkbox sits beside its label', boxes.length >= 8 && boxes.every((b) => b.beside && b.sameLine), JSON.stringify(boxes.filter((b) => !b.beside || !b.sameLine)));
  const musicVol = await page.isVisible('text=Music volume');
  await page.click('label:has-text("Music (M)") input');
  const musicOff = await page.evaluate(() => window.colonia.music.enabled === false && !window.colonia.music.playing);
  await page.click('label:has-text("Music (M)") input');
  const musicOn = await page.evaluate(() => window.colonia.music.enabled === true);
  check('settings: music switch and volume', musicVol && musicOff && musicOn, JSON.stringify({ musicVol, musicOff, musicOn }));
  await page.click('.modal button:has-text("Done")'); // closes the menus: back to the game
  await page.keyboard.press('m');
  const mOff = await page.evaluate(() => window.colonia.settings.music === false && window.colonia.music.enabled === false);
  await page.keyboard.press('m');
  const mOn = await page.evaluate(() => window.colonia.settings.music === true);
  check('M key switches the music off and on', mOff && mOn);
  // The track library, live: a named track plays, and a change of mood from
  // day to night lets a day-only track finish its phrase and end (no cut).
  const lib = await page.evaluate(async () => {
    const m = window.colonia.music;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    m.force('day');
    m.play('prima-lux');
    await wait(500);
    const title = m.piece && m.piece.track ? m.piece.track.title : null;
    m.force('night');
    await wait(300);
    const still = m.piece && m.piece.track ? m.piece.track.title : null;
    const ending = m.piece ? m.piece.sections[m.piece.sections.length - 1].name : null;
    const left = m.piece ? m.piece.sections.length - m.piece.sectionIndex : -1;
    m.force('auto');
    return { title, still, ending, left, now: m.nowPlaying };
  });
  check('music: a named track plays; a change of mood lets it end its phrase instead of cutting it', lib.title === 'Prima Lux' && lib.still === 'Prima Lux' && lib.ending === 'outro' && lib.left >= 1 && lib.left <= 2, JSON.stringify(lib));
  // The synthesized music itself: every mood rendered offline, measured.
  const mc = await page.evaluate(() => window.colonia.musicSelfCheck(4));
  const mcOk = Object.values(mc).every((m) => !m.bad && m.peak > 0.02 && m.peak < 0.99 && m.rmsDb > -45);
  check('every music mood renders: audible, not clipping', mcOk, Object.entries(mc).map(([k, v]) => `${k} ${v.rmsDb}dB/${v.peak}`).join(', '));
  // (Seen from another side: the view turn goes with the save's camera.)
  await page.evaluate(() => window.colonia.turnView(2));
  const savedNow = await page.evaluate(() => ({ b: window.colonia.game.buildings.size }));
  await page.keyboard.press('F5');
  // Leaving the page writes the autosave slot (localStorage).
  const autoBefore = await page.evaluate(() => localStorage.getItem('colonia.save.auto'));
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const autoAfter = await page.evaluate(() => { const s = localStorage.getItem('colonia.save.auto'); return s ? JSON.parse(s).meta : null; });
  check('autosave written when the page is hidden/closed', !!autoAfter && (!autoBefore || JSON.parse(autoBefore).meta.savedAt !== autoAfter.savedAt), autoAfter ? autoAfter.savedAt : 'none');
  await page.reload();
  await page.waitForSelector('.menu-card');
  check('Continue offered after a quick save', await page.isVisible('text=Continue'));
  await page.evaluate(() => window.colonia.quickLoad());
  await page.waitForFunction(() => window.colonia.game, null, { timeout: 15000 });
  const loaded = await page.evaluate(() => window.colonia.game.buildings.size);
  check('quick save survives a reload', loaded === savedNow.b, `${savedNow.b} vs ${loaded}`);
  const turnLoaded = await page.evaluate(() => ({ turn: window.colonia.renderer.camera.turn, needle: document.getElementById('hud-north')?.dataset.turn }));
  check('the view turn is kept with the save', turnLoaded.turn === 2, JSON.stringify(turnLoaded));
  await page.evaluate(() => window.colonia.turnView(-window.colonia.renderer.viewTurn));
  const units = await page.evaluate(() => window.colonia.game.units.size);
  check('soldiers and raiders survive save + load', units > 0, `${units} units`);
  // A save made when a salary above the rank was allowed (sim/governor.js
  // salaryWithinRank): it loads at the rank's rate, and the toast says what
  // went back to the treasury (it is said while the save loads, before the
  // game's messages reach the screen, so the app shows it after).
  const lowered = await page.evaluate(() => {
    const app = window.colonia;
    const raw = JSON.parse(localStorage.getItem('colonia.save.quick'));
    const gv = raw.city.governor;
    Object.assign(gv, { salaryRank: Math.min(10, gv.rank + 1), savings: 500, paidThisYear: 100000 });
    app.importText(JSON.stringify(raw));
    const now = app.game.city.governor;
    return { rank: now.rank, salaryRank: now.salaryRank, savings: now.savings, toast: [...document.querySelectorAll('#messages .toast')].map((t) => t.textContent).find((t) => /pays no governor above his rank/.test(t)) || '' };
  });
  check('an older save drawing a salary above the rank loads at the rank\'s rate, and a toast says what went back to the treasury',
    lowered.salaryRank === lowered.rank && lowered.savings === 0 && /your salary is an? \w+'s \d+ Dn a month, and the 500 Dn you drew above/.test(lowered.toast) && errors.length === 0, JSON.stringify(lowered));
  await page.keyboard.press('Escape');
  await page.click('text=Save game');
  check('save menu shows localStorage usage', await page.isVisible('text=Stored in this browser (localStorage)'));
  // Each saved slot exports on its own, without loading it: the file is the
  // slot's text exactly as stored, named after the slot, city and year.
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
    page.click('.modal .card:has-text("Quicksave") .slot-export'),
  ]);
  let slotFile = null;
  if (dl) {
    const p = await dl.path();
    const text = p ? fs.readFileSync(p, 'utf8') : '';
    const stored = await page.evaluate(() => localStorage.getItem('colonia.save.quick'));
    slotFile = { name: dl.suggestedFilename(), same: text === stored };
  }
  check('a save slot exports to a file of its own', !!slotFile && /^colonia-quick-.+-\d+(bc|ad)\.json$/.test(slotFile.name) && slotFile.same, JSON.stringify(slotFile));
  await page.keyboard.press('Escape');

  // 6. In-game confirm dialog: restart the map from the pause menu
  await page.keyboard.press('Escape');
  await page.click('text=Restart this map');
  const dialog = await page.isVisible('[role="alertdialog"]');
  check('restart asks for confirmation in-game', dialog);
  await page.click('[role="alertdialog"] .btn.danger');
  const fresh = await page.evaluate(() => window.colonia.game.buildings.size);
  check('confirming restart starts a fresh map', fresh === 0, `${fresh} buildings`);

  // 6b. A campaign mission on Insane: the briefing picks the difficulty,
  //     scales the starting funds, and the game remembers both. The game is
  //     left paused: the menu's town behind it must run all the same (it
  //     stood frozen once a pause could stop the loop for any game).
  await page.evaluate(() => { window.colonia.paused = true; window.colonia.toMainMenu(); });
  await page.waitForSelector('.menu-card');
  const menuTicks = await page.evaluate(() => window.colonia.menuGame?.time.totalTicks ?? -1);
  await page.waitForTimeout(600);
  const menuTicks2 = await page.evaluate(() => window.colonia.menuGame?.time.totalTicks ?? -1);
  check('the menu\'s town runs after leaving a paused game', menuTicks >= 0 && menuTicks2 > menuTicks, JSON.stringify({ menuTicks, menuTicks2 }));
  await page.click('.menu-card button:has-text("Campaign")');
  await page.click('.scenario >> nth=0');
  await page.selectOption('.modal select.difficulty-select', 'insane');
  const fundsText = await page.textContent('.modal .row:has-text("Starting funds")');
  const shownFunds = Number((/Starting funds: ([\d,]+) Dn/.exec(fundsText) || [])[1]?.replace(/,/g, ''));
  await page.click('.modal button:has-text("Begin")');
  await page.waitForFunction(() => window.colonia.game && window.colonia.game.scenario.id === 'c1', null, { timeout: 15000 });
  {
    const m0 = await page.evaluate(() => ({ ...window.colonia.input.mouse, game: undefined }));
    const c0 = await camAt();
    await page.waitForTimeout(500);
    const c1 = await camAt();
    const d = Math.hypot(c1.x - c0.x, c1.y - c0.y);
    check('campaign start: the view holds still without input', d < 1 && !c1.moving, `moved ${Math.round(d)} world px, input.mouse at start ${JSON.stringify(m0)}`);
  }
  const camp = await page.evaluate(() => { const g = window.colonia.game; return { key: g.difficultyKey, treasury: Math.round(g.city.treasury), pref: window.colonia.settings.difficulty, winter: g.messages.some((m) => /nothing grows on the farms/.test(m.text)) }; });
  check('Insane mission start warns that nothing grows on the farms in winter', camp.winter);
  check('campaign briefing starts a mission on Insane with scaled funds', camp.key === 'insane' && camp.treasury === 2400 && shownFunds === 2400 && camp.pref === 'insane', JSON.stringify({ ...camp, shownFunds }));
  await page.keyboard.press('Escape');
  await page.click('.modal button:has-text("Mission briefing")');
  const inGame = await page.isVisible('.modal :text("Difficulty: Insane")') && await page.isVisible('.modal button:has-text("Close")') && !(await page.isVisible('.modal select.difficulty-select'));
  check('in-game briefing shows the difficulty being played', inGame);
  await page.click('.modal button:has-text("Close")');

  // 6b2. Campaign branches: winning mission 2 offers step 3's two provinces
  //      as two cards side by side; a card's Start opens its briefing, whose
  //      Back returns to the choice, and Begin starts that province. The
  //      campaign list then shows step 3's siblings side by side.
  {
    await page.evaluate(() => { const app = window.colonia; app.newScenario('c2'); app.onVictory(); });
    // The Hall of Fame (sim/fame.js): the win's score and its place on the victory screen.
    const fameWin = await page.evaluate(() => document.querySelector('.modal .fame-win')?.textContent || '');
    check('the victory screen scores the win and gives its place in the Hall of Fame', /Score: [\d,]+ points, the 1st best win in the Hall of Fame/.test(fameWin) && /Ratings added/.test(fameWin), fameWin.slice(0, 200));
    await page.click('.modal button.choose-post');
    const cards = await page.$$eval('.modal .post-card', (els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      return { id: e.dataset.id, track: e.querySelector('.track')?.textContent, x: Math.round(r.left), y: Math.round(r.top), start: !!e.querySelector('button.post-start'), text: e.textContent };
    }));
    const sideBySide = cards.length === 2 && cards[0].y === cards[1].y && cards[0].x < cards[1].x;
    check('victory at step 2 offers two provinces as cards side by side: Figlina (Peaceful) and Firmum (Military), each with Start',
      sideBySide && cards[0].id === 'c3' && cards[0].track === 'Peaceful' && cards[1].id === 'c3m' && cards[1].track === 'Military' && cards.every((c) => c.start) && /First raid after about 2 years/.test(cards[1].text),
      JSON.stringify(cards.map(({ text, ...c }) => c)));
    await page.click('.modal .post-card[data-id="c3m"] button.post-start');
    const brief = await page.textContent('.modal .modal-head h2');
    // The province's own market (sim/prices.js) is in its briefing.
    const market = await page.evaluate(() => document.querySelector('.modal .market-line')?.textContent || '');
    check('Firmum\'s briefing names its local market', market === 'Local market: Iron (-15%) and olives (-10%) are cheap here; wine (+15%) is dear, to buy and to sell.', market);
    // Escape must not drop the player into the city with no way back to the choice.
    await page.keyboard.press('Escape');
    const afterEsc = await page.evaluate(() => document.querySelector('.modal .modal-head h2')?.textContent || null);
    if (afterEsc) await page.click('.modal .modal-foot button:has-text("Back")');
    else { await page.evaluate(() => window.colonia.onVictory()); await page.click('.modal button.choose-post'); } // carry on after the failure
    const backTo = await page.$$eval('.modal .post-card', (els) => els.map((e) => e.dataset.id));
    check('a card opens its province\'s briefing, Escape keeps it open, and Back returns to the choice', /Firmum/.test(brief) && afterEsc === brief && backTo.join() === 'c3,c3m', JSON.stringify({ brief, afterEsc, backTo }));
    await page.click('.modal .post-card[data-id="c3m"] button.post-start');
    await page.click('.modal button:has-text("Begin")');
    await page.waitForFunction(() => window.colonia.game && window.colonia.game.scenario.id === 'c3m', null, { timeout: 15000 });
    const firmum = await page.evaluate(() => { const g = window.colonia.game; return { rank: g.city.governor.rank, raid: g.military.nextRaidMonth, done: window.colonia.progress.completed }; });
    check('Begin starts Firmum at the Engineer\'s rank, raids due within two years', firmum.rank === 2 && firmum.raid >= 18 && firmum.raid <= 24 && firmum.done.includes('c2'), JSON.stringify(firmum));
    await page.evaluate(() => window.colonia.toMainMenu());
    await page.waitForSelector('.menu-card');
    await page.click('.menu-card button:has-text("Campaign")');
    const step3 = await page.$$eval('.scenario-step', (rows) => rows.map((r) => [...r.querySelectorAll('button.scenario')].map((b) => {
      const box = b.getBoundingClientRect();
      return { id: b.dataset.id, locked: b.classList.contains('locked'), y: Math.round(box.top) };
    }))[2]);
    check('the campaign list shows step 3\'s two provinces side by side, both open after mission 2',
      step3?.length === 2 && step3[0].id === 'c3' && step3[1].id === 'c3m' && step3[0].y === step3[1].y && !step3[0].locked && !step3[1].locked, JSON.stringify(step3));
    // Ten steps: one mission at steps 1 and 2, two side by side from step 3.
    const perStep = await page.$$eval('.scenario-step', (rows) => rows.map((r) => r.querySelectorAll('button.scenario').length));
    check('the campaign list has ten steps, two provinces at each from step 3', perStep.join() === '1,1,2,2,2,2,2,2,2,2', perStep.join());
    await page.click('.modal button.hall-of-fame');
    const hall = await page.evaluate(() => ({
      title: document.querySelector('.modal .modal-head h2')?.textContent,
      rows: [...document.querySelectorAll('.modal table.fame tr.fame-row')].map((r) => r.textContent),
      stored: JSON.parse(localStorage.getItem('colonia.fame') || 'null'),
    }));
    check('the campaign screen opens the Hall of Fame: mission 2\'s win listed and stored beside the progress, not in a save',
      hall.title === 'Hall of Fame' && hall.rows.length === 1 && /Aquae Clarae/.test(hall.rows[0]) && hall.stored?.wins?.[0]?.mission === 'c2', JSON.stringify(hall));
    await page.click('.modal button:has-text("Back")'); // back to the campaign list
    await page.click('.modal button:has-text("Back")');
    await page.click('.menu-card button.hall-of-fame');
    const hall2 = await page.evaluate(() => ({ title: document.querySelector('.modal .modal-head h2')?.textContent, career: document.querySelector('.modal .fame-career')?.textContent || '' }));
    check('the main menu opens the Hall of Fame with the career\'s score', hall2.title === 'Hall of Fame' && /Your career: [\d,]+ points/.test(hall2.career), JSON.stringify(hall2));
    await page.click('.modal button:has-text("Back")');
  }

  // 6b3. The last step: a province starts on its big map of regions, and its
  //      victory hails the governor Caesar with no next post; the campaign
  //      list then says so.
  {
    await page.evaluate(() => window.colonia.newScenario('c10p'));
    await page.waitForFunction(() => window.colonia.game && window.colonia.game.scenario.id === 'c10p', null, { timeout: 20000 });
    const big = await page.evaluate(() => { const g = window.colonia.game; return { w: g.map.w, h: g.map.h, rank: g.city.governor.rank, regions: !!g.mapInfo?.regions }; });
    check('a step-10 province starts on its 224 map of resource regions, at the Proconsul\'s rank', big.w === 224 && big.h === 224 && big.rank === 9 && big.regions, JSON.stringify(big));
    await page.evaluate(() => window.colonia.onVictory());
    const crown = await page.evaluate(() => ({
      title: document.querySelector('.modal .modal-head h2')?.textContent,
      line: document.querySelector('.modal .governor-line')?.textContent || '',
      choose: !!document.querySelector('.modal button.choose-post'),
      next: [...document.querySelectorAll('.modal .modal-foot button')].map((b) => b.textContent),
    }));
    check('winning the last step hails you Caesar, with no next post', crown.title === 'Hail, Caesar!' && /Rome hails you Caesar/.test(crown.line) && !crown.choose && !crown.next.some((t) => /^Next/.test(t)), JSON.stringify(crown));
    await page.evaluate(() => window.colonia.toMainMenu());
    await page.waitForSelector('.menu-card');
    await page.click('.menu-card button:has-text("Campaign")');
    const caesar = await page.textContent('.modal .caesar-line').catch(() => null);
    check('the campaign list says the career is crowned', /Rome hails you Caesar/.test(caesar || ''), String(caesar));
    await page.click('.modal button:has-text("Back")');
  }

  // 6c. Where autoplay is allowed the menu music starts with no gate at all.
  {
    const b2 = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const p2 = await b2.newPage();
    await p2.goto(url);
    await p2.waitForFunction(() => window.colonia && window.colonia.music.barsPlayed > 0, null, { timeout: 8000 }).catch(() => {});
    const auto = await p2.evaluate(() => ({ playing: window.colonia.music.playing, mood: window.colonia.music.mood, gate: !!document.getElementById('title-gate') }));
    check('autoplay allowed: menu music starts at once, no gate', auto.playing && auto.mood === 'menu' && !auto.gate, JSON.stringify(auto));
    await b2.close();
  }

  // 6d. The fleet (sim/navy.js) on a coast: place a Naval Station and a
  //     Navalia with the mouse, then a working fleet (console `navy`), its
  //     squadron deployed by the station's Deploy button and a click on the
  //     water, a ship's panel, the Military advisor's stations, a raid by sea.
  {
    const np = await ctx.newPage();
    const nerrors = [];
    np.on('pageerror', (e) => nerrors.push(`pageerror: ${e.message}`));
    np.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) nerrors.push(m.text()); });
    await np.goto(`${url}?skipmenu=1&maptype=coast&map=small&seed=demo&mute=1&money=90000`);
    await np.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 15000 });
    await np.evaluate(() => { const app = window.colonia; app.paused = true; app.ui.console.run('demo 2'); app.ui.console.run('days 60'); app.renderer.camera.zoomIndex = 2; });
    // Fishing, on this fixed coast map (the main game's random seed may have
    // no water with fishing grounds near its city): the console's builder
    // places a shipyard and wharves, and a wharf's panel shows its boat and
    // catch. It runs before the fleet takes its two spots on the shore.
    const fish = await np.evaluate(() => {
      const app = window.colonia;
      const g = app.game;
      const free = g.cheats.freeBuild;
      g.cheats.freeBuild = true;
      const out = { fish: app.ui.console.run('fishing') };
      g.cheats.freeBuild = free;
      const wharf = [...g.buildings.values()].find((b) => b.type === 'wharf');
      if (wharf) { app.ui.info.showBuilding(wharf.id); out.wharf = document.querySelector('#info-panel')?.textContent || ''; }
      // The builder stocks its shipyard with timber (boats take 100 each).
      const yard = [...g.buildings.values()].find((b) => b.type === 'shipyard');
      if (yard) { app.ui.info.showBuilding(yard.id); out.yard = document.querySelector('#info-panel')?.textContent || ''; }
      app.ui.info.close();
      return out;
    });
    check('a wharf can be placed, and its panel shows its boat and catch', /Fishing/.test(fish.wharf || '') && /Catch in store/.test(fish.wharf || '') && nerrors.length === 0, JSON.stringify({ fish: fish.fish, wharf: (fish.wharf || '').slice(0, 160), nerrors }));
    check('the shipyard panel shows its timber against the 100 a boat takes', /Timber\s*400 \/ 100/.test(fish.yard || ''), (fish.yard || '').slice(0, 200));
    const nScreen = (tx, ty) => np.evaluate(([x, y]) => {
      const cam = window.colonia.renderer.camera;
      const wx = (x + 0.5 - (y + 0.5)) * 32;
      const wy = (x + 0.5 + (y + 0.5)) * 16;
      const r = window.colonia.canvas.getBoundingClientRect();
      return { x: r.left + ((wx - cam.x) * cam.scale) / cam.dpr, y: r.top + ((wy - cam.y) * cam.scale) / cam.dpr };
    }, [tx, ty]);
    // 3x3 spots on the shore of the sea: some out over the water as the
    // rule asks (its two front rows on navigable water, the back row open
    // land, water to tie up at in front), apart from each other; and one
    // wholly on land right at the water's edge (the older rule's spot).
    const shore = await np.evaluate(() => {
      const g = window.colonia.game;
      const m = g.map;
      const water = (x, y) => m.inBounds(x, y) && m.terrain[m.idx(x, y)] === 4;
      const openWater = (x, y) => water(x, y) && m.navigable[m.idx(x, y)] && !m.building[m.idx(x, y)] && !m.road[m.idx(x, y)];
      const land = (x, y) => m.isFree(x, y) && m.terrain[m.idx(x, y)] !== 2;
      // Side s (0 = -y, 1 = +x, 2 = +y, 3 = -x): tile (dx, dy) of the footprint, rows counted from that side.
      const rowFrom = (s, dx, dy) => (s === 0 ? dy : s === 1 ? 2 - dx : s === 2 ? 2 - dy : dx);
      const past = (s, d, x, y) => [s === 1 ? x + 3 : s === 3 ? x - 1 : x + d, s === 0 ? y - 1 : s === 2 ? y + 3 : y + d];
      const fits = (x, y) => [0, 1, 2, 3].some((s) => {
        for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) if (rowFrom(s, dx, dy) < 2 ? !openWater(x + dx, y + dy) : !land(x + dx, y + dy)) return false;
        return openWater(...past(s, 1, x, y));
      });
      const wholeSide = (x, y) => [0, 1, 2, 3].some((s) => [0, 1, 2].every((d) => water(...past(s, d, x, y))));
      const out = [];
      let edge = null;
      for (let y = 2; y < m.h - 5; y++) {
        for (let x = 2; x < m.w - 5; x++) {
          if (fits(x, y)) {
            if (out.length < 12 && out.every((o) => Math.abs(o.x - x) > 4 || Math.abs(o.y - y) > 4)) out.push({ x, y });
            continue;
          }
          let open = true;
          for (let dy = 0; dy < 3 && open; dy++) for (let dx = 0; dx < 3; dx++) if (!land(x + dx, y + dy)) { open = false; break; }
          if (open && !edge && wholeSide(x, y)) edge = { x, y };
        }
      }
      if (out[0]) window.colonia.renderer.camera.centerOnTile(out[0].x + 1, out[0].y + 1);
      return { spots: out, edge };
    });
    const spots = shore.spots;
    // The shore rule: a Naval Station held wholly on land at the water's
    // edge is red and says why; nothing is built there.
    if (shore.edge) {
      const s = shore.edge;
      await np.evaluate((t) => { window.colonia.renderer.camera.centerOnTile(t.x + 1, t.y + 1); window.colonia.ui.selectTool('naval_station'); }, s);
      await np.waitForTimeout(250);
      const p = await nScreen(s.x + 1, s.y + 1);
      await np.mouse.move(p.x - 5, p.y);
      await np.mouse.move(p.x, p.y);
      await np.waitForTimeout(150);
      await np.mouse.click(p.x, p.y);
      const refused = await np.evaluate((t) => {
        const app = window.colonia;
        const plan = app.renderer.plan;
        return { ok: plan?.items[0]?.ok, reason: plan?.reason, at: plan && [plan.items[0].x, plan.items[0].y], side: document.querySelector('#tool-info .err')?.textContent || '', built: !!app.game.map.building[app.game.map.idx(t.x, t.y)] };
      }, s);
      check('shore rule: a waterside building held wholly on land is red, says two rows must stand on the water, and builds nothing',
        refused.ok === false && refused.reason === 'Two rows of the Statio must stand on the water, the rest on the shore' && /must stand on the water/.test(refused.side) && !refused.built, JSON.stringify({ edge: s, refused }));
      await np.mouse.click(10, 300, { button: 'right' });
    } else {
      check('shore rule: this coast has open land right at the water\'s edge', false, 'none found');
    }
    check('fleet: open shore for a station and a navalia, out over the water', spots.length >= 2, JSON.stringify(spots));
    // Each placed by a click, on the first spot its preview shows green
    // (the page finds spots by the terrain; the game checks the rest).
    const placed = [];
    let next = 0;
    for (const type of ['naval_station', 'navalia']) {
      let done = false;
      for (; next < spots.length && !done; next++) {
        const s = spots[next];
        await np.evaluate(([s, t]) => { window.colonia.renderer.camera.centerOnTile(s.x + 1, s.y + 1); window.colonia.ui.selectTool(t); }, [s, type]);
        await np.waitForTimeout(250);
        const p = await nScreen(s.x + 1, s.y + 1); // the cursor is the middle of a 3x3
        await np.mouse.move(p.x - 5, p.y);
        await np.mouse.move(p.x, p.y);
        await np.waitForTimeout(100);
        if (!(await np.evaluate(() => !!window.colonia.renderer.plan?.items[0]?.ok))) continue;
        await np.mouse.click(p.x, p.y);
        done = await np.evaluate(([s, t]) => {
          const g = window.colonia.game;
          const b = g.buildings.get(g.map.building[g.map.idx(s.x, s.y)]);
          return b?.type === t && b.waterRows === 2 && g.map.navigable[g.map.idx(s.x + 1, s.y + 1)] === 0;
        }, [s, type]);
      }
      placed.push(done);
    }
    check('fleet: a click places a Naval Station and a Navalia on the shore', placed.length === 2 && placed.every(Boolean), JSON.stringify(placed));
    await np.mouse.click(10, 300, { button: 'right' });
    // A working fleet: stocked, staffed (military first), a few months on.
    const fleet = await np.evaluate(() => {
      const app = window.colonia;
      const out = app.ui.console.run('navy');
      app.game.city.laborPriority = ['military'];
      app.ui.console.run('days 140');
      const g = app.game;
      const st = [...g.buildings.values()].filter((b) => b.def.kind === 'station').find((b) => [...g.units.values()].some((u) => u.station === b.id));
      return { out, st: st ? { id: st.id, x: st.x, y: st.y } : null, ships: [...g.units.values()].filter((u) => u.type === 'liburnian').length };
    });
    check('fleet: the navalia builds liburnians that berth at a station', fleet.ships >= 1 && !!fleet.st, JSON.stringify(fleet));
    if (fleet.st) {
      await np.evaluate((s) => { window.colonia.renderer.camera.centerOnTile(s.x + 1, s.y + 1); window.colonia.ui.info.showBuilding(s.id); }, fleet.st);
      await np.waitForTimeout(250);
      await np.click('#info-panel button:has-text("Deploy")');
      const water = await np.evaluate((s) => {
        const m = window.colonia.game.map;
        const st = window.colonia.game.buildings.get(s.id);
        const body = m.navBody[st.berth];
        for (let r = 5; r < 12; r++) for (const [dx, dy] of [[r, 0], [0, r], [-r, 0], [0, -r], [r, r], [-r, -r]]) {
          const x = s.x + 1 + dx; const y = s.y + 1 + dy;
          if (m.inBounds(x, y) && m.navBody[m.idx(x, y)] === body) return { x, y };
        }
        return null;
      }, fleet.st);
      if (water) {
        const p = await nScreen(water.x, water.y);
        await np.mouse.click(p.x, p.y);
      }
      const rally = await np.evaluate((id) => window.colonia.game.buildings.get(id).rally, fleet.st.id);
      check('fleet: Deploy and a click on the water send the squadron there', !!water && !!rally && Math.abs(Math.floor(rally.x) - water.x) <= 2 && Math.abs(Math.floor(rally.y) - water.y) <= 2, JSON.stringify({ water, rally }));
      // The squadron's flag dragged onto dry land (no water of its own within
      // 2 tiles): it stays on the water where it was.
      if (rally) {
        const drag = await np.evaluate((sid) => {
          const app = window.colonia;
          const g = app.game;
          const m = g.map;
          const st = g.buildings.get(sid);
          const body = m.navBody[st.berth];
          app.ui.info.close();
          app.renderer.camera.centerOnTile(Math.floor(st.rally.x), Math.floor(st.rally.y));
          return { body, rx: Math.floor(st.rally.x), ry: Math.floor(st.rally.y) };
        }, fleet.st.id);
        await np.waitForTimeout(250);
        const pts = await np.evaluate(([sid, d]) => {
          const app = window.colonia;
          const m = app.game.map;
          const r = app.renderer;
          const cam = r.camera;
          const rect = app.canvas.getBoundingClientRect();
          const css = (wx, wy) => ({ x: rect.left + ((wx - cam.x) * cam.scale) / cam.dpr, y: rect.top + ((wy - cam.y) * cam.scale) / cam.dpr });
          const s = r.flagSpots.find((o) => o.id === sid);
          const dryAround = (x, y) => {
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (m.inBounds(x + dx, y + dy) && m.navBody[m.idx(x + dx, y + dy)] === d.body) return false;
            return true;
          };
          let land = null;
          for (let rr = 4; rr < 16 && !land; rr++) for (const [dx, dy] of [[rr, 0], [0, rr], [-rr, 0], [0, -rr], [rr, rr], [-rr, -rr], [rr, -rr], [-rr, rr]]) {
            const x = d.rx + dx;
            const y = d.ry + dy;
            if (!m.inBounds(x, y) || !dryAround(x, y)) continue;
            const w = r.worldAt(x + 0.5, y + 0.5);
            const p = css(w.x, w.y);
            if (document.elementFromPoint(p.x, p.y) === app.canvas) { land = { tx: x, ty: y, x: p.x, y: p.y }; break; }
          }
          return { flag: s ? css(s.wx + 4, s.wy - 20) : null, land };
        }, [fleet.st.id, drag]);
        if (pts.flag && pts.land) {
          await np.mouse.move(pts.flag.x, pts.flag.y);
          await np.mouse.down();
          await np.mouse.move(pts.land.x, pts.land.y, { steps: 8 });
          const ghost = await np.evaluate(() => window.colonia.renderer.flagDrag);
          await np.mouse.up();
          const after = await np.evaluate((id) => window.colonia.game.buildings.get(id).rally, fleet.st.id);
          check('fleet: the squadron\'s flag dragged onto dry land stays on the water where it was', !!ghost && ghost.x === pts.land.tx && ghost.y === pts.land.ty && JSON.stringify(after) === JSON.stringify(rally), JSON.stringify({ pts, ghost, rally, after }));
        } else check('fleet: the squadron\'s flag dragged onto dry land stays on the water where it was', false, JSON.stringify(pts));
      }
      await np.evaluate(() => { window.colonia.paused = false; window.colonia.ui.console.run('days 8'); window.colonia.paused = true; });
      // Click a liburnian: its panel.
      await np.evaluate(() => { const u = [...window.colonia.game.units.values()].find((v) => v.type === 'liburnian'); window.colonia.renderer.camera.centerOnTile(Math.floor(u.x), Math.floor(u.y)); });
      await np.waitForTimeout(400);
      const shipAt = await np.evaluate(() => {
        const r = window.colonia.renderer;
        const s = r.shipSpots.find((o) => window.colonia.game.units.get(o.id)?.type === 'liburnian');
        if (!s) return null;
        const cam = r.camera;
        const rect = window.colonia.canvas.getBoundingClientRect();
        return { x: rect.left + ((s.wx - cam.x) * cam.scale) / cam.dpr, y: rect.top + ((s.wy - 12 - cam.y) * cam.scale) / cam.dpr };
      });
      if (shipAt) await np.mouse.click(shipAt.x, shipAt.y);
      await np.waitForTimeout(200);
      const panel = await np.evaluate(() => ({ kind: window.colonia.ui.info.target?.kind, text: document.getElementById('info-panel').textContent }));
      check('fleet: clicking a liburnian shows its panel', panel.kind === 'unit' && /Liburnian/.test(panel.text) && /Hull/.test(panel.text), JSON.stringify({ kind: panel.kind }));
      if (shots) await np.screenshot({ path: path.join(shots, 'smoke-fleet.png') });
    }
    await np.keyboard.press('F2');
    await np.click('.tab:has-text("Military")');
    check('fleet: the Military advisor shows the fleet and its stations', await np.isVisible('.modal h4:has-text("Fleet")') && await np.isVisible('.modal th:has-text("Station")'));
    await np.keyboard.press('Escape');
    const raid = await np.evaluate(() => {
      const app = window.colonia;
      const said = app.ui.console.run('searaid 10');
      app.ui.console.run('days 3');
      const g = app.game;
      return { said, sea: !!g.military.active?.sea, ships: [...g.units.values()].filter((u) => u.type === 'raider_ship').length };
    });
    check('fleet: a raid by sea sails in on raider ships', raid.sea && raid.ships >= 1, JSON.stringify(raid));
    check('fleet: no errors on the coast', nerrors.length === 0, nerrors.join(' | '));
    await np.close();
  }

  // 6d. A sandbox founded at another place on the empire map: the setup's
  //     choice reaches the game, and a route's card says how far it is.
  {
    const sp = await browser.newPage();
    const serrors = [];
    sp.on('pageerror', (e) => serrors.push(e.message));
    await sp.goto(`${url}?mute=1`);
    await sp.click('text=Sandbox');
    await sp.selectOption('select.site-select', 'puteoli');
    await sp.click('text=Found the city');
    await sp.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 15000 });
    const site = await sp.evaluate(() => window.colonia.game.scenario.site);
    await sp.keyboard.press('F2');
    await sp.click('.tab:has-text("Trade")');
    const pace = await sp.$$eval('.modal .route-pace', (els) => els.map((e) => e.textContent));
    check('sandbox at Puteoli: the setup\'s place reaches the game, and the Capua card says it is a day off', site === 'puteoli' && pace.includes('About 1 day on the road each way; a caravan every 32 to 56 days.') && serrors.length === 0, JSON.stringify({ site, pace: pace.slice(0, 4), serrors }));
    // Prices per partner (sim/prices.js): Capua, the nearest, at base; Gades,
    // the farthest, a quarter dearer both ways; each good on a card at that
    // partner's price, and the Import and Export choices the range across partners.
    const prices = await sp.evaluate(() => {
      const cards = [...document.querySelectorAll('.modal .card')].filter((c) => c.querySelector('.route-prices'));
      const card = (name) => cards.find((c) => c.querySelector('h4')?.textContent.includes(name));
      const chips = (name) => [...(card(name)?.querySelectorAll('.trade-good') || [])].map((e) => e.textContent);
      return {
        capua: card('Capua')?.querySelector('.route-prices').textContent,
        gades: card('Gades')?.querySelector('.route-prices').textContent,
        capuaChips: chips('Capua'),
        gadesChips: chips('Gades'),
        options: [...document.querySelectorAll('.modal select option')].map((o) => o.textContent).filter((t) => /^(Import|Export)/.test(t)),
      };
    });
    check('trade prices: Capua at base, Gades +25% both ways, each good at its partner\'s price, Import and Export as ranges',
      prices.capua === 'Base prices: your nearest partner.' && prices.gades === 'Prices +25% for the distance, to buy and to sell.'
        && prices.capuaChips.includes('🍷 Wine 0/600 · 215 Dn') && prices.gadesChips.includes('🫒 Olives 0/1,500 · 58 Dn')
        && prices.options.some((t) => /^Import \(buy \d+ to \d+\)$/.test(t)) && prices.options.some((t) => /^Export \(sell \d+ to \d+\)$/.test(t)),
      JSON.stringify(prices));
    // Trade by partner (sim/tradeSwitches.js): wine on Import, then Capua's
    // wine switch unticked on its card. The game's switch goes off, the card
    // redraws with it unticked and greyed, and the Goods row counts the
    // sellers left on (Capua, Massilia and Rhodus sell wine).
    await sp.selectOption('.modal tr:has(td:text-is("🍷 Wine")) select', 'import');
    const wineSwitch = '.modal .card:has(h4:has-text("Capua")) label.trade-good:has-text("Wine") input.trade-switch';
    await sp.click(wineSwitch);
    const switched = await sp.evaluate(() => {
      const g = window.colonia.game;
      const card = [...document.querySelectorAll('.modal .card')].find((c) => c.querySelector('h4')?.textContent.includes('Capua') && c.querySelector('.route-prices'));
      const box = [...(card?.querySelectorAll('label.trade-good') || [])].find((l) => l.textContent.includes('Wine'))?.querySelector('input.trade-switch');
      return {
        off: g.city.trade.routes.capua.off,
        checked: box?.checked,
        grey: box?.closest('label').classList.contains('off'),
        row: document.querySelector('.modal tr:has(.trade-partners)')?.querySelector('.trade-partners')?.textContent,
        mode: g.city.trade.settings.wine.mode,
      };
    });
    check('trade by partner: unticking Capua\'s wine switches it off in the game and the Goods row says "from 2 of 3 sellers"',
      switched.off?.wine === true && switched.checked === false && switched.grey && switched.mode === 'import' && switched.row === 'from 2 of 3 sellers' && serrors.length === 0,
      JSON.stringify({ switched, serrors }));
    await sp.click(wineSwitch);
    const back = await sp.evaluate(() => window.colonia.game.city.trade.routes.capua.off);
    check('trade by partner: ticking it again switches it back on', JSON.stringify(back) === '{}', JSON.stringify(back));
    await sp.close();
  }

  // 6e0. Native villages (sim/natives.js) in a sandbox that asks for them:
  //      the mission post in the Temples menu, a hut's panel, the Native
  //      land overlay, an attack on a building put on their land, and the
  //      village drawn at every view turn without an error.
  {
    const vp = await ctx.newPage();
    const verrors = [];
    vp.on('pageerror', (e) => verrors.push(`pageerror: ${e.message}`));
    vp.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) verrors.push(m.text()); });
    await vp.goto(`${url}?skipmenu=1&natives=1&map=small&seed=demo&mute=1&money=90000`);
    await vp.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 15000 });
    const village = await vp.evaluate(() => {
      const app = window.colonia;
      app.paused = true;
      const g = app.game;
      const huts = [...g.buildings.values()].filter((b) => b.type === 'native_hut');
      const m = [...g.buildings.values()].find((b) => b.type === 'native_meeting');
      if (!m || !huts.length) return null;
      app.renderer.camera.zoomIndex = 2;
      app.renderer.camera.centerOnTile(m.x + 1, m.y + 1);
      app.ui.info.showBuilding(huts[0].id);
      const panel = document.querySelector('#info-panel')?.textContent || '';
      app.ui.info.close();
      return { m: { x: m.x, y: m.y }, huts: huts.length, panel, people: g.city.natives?.people };
    });
    check('a sandbox with native villages: huts round a meeting place, a hut\'s panel says it is angry', !!village && village.huts >= 4 && /Tugurium \(Native Hut\)/.test(village.panel) && /Angry/.test(village.panel), JSON.stringify(village && { ...village, panel: village.panel.slice(0, 200) }));
    await vp.click('.cat-btn[title^="Temples"]');
    const post = await vp.evaluate(() => document.querySelector('.build-item[data-key="mission_post"] .nm')?.textContent || '');
    check('the Sacellum Pacis (Mission Post) is in the Temples menu where there are villages', /Sacellum Pacis/.test(post), post);
    if (village) {
      // A garden placed with the mouse on the meeting place's land; a day on, the village attacks.
      const spot = await vp.evaluate(({ m }) => {
        const g = window.colonia.game;
        for (let d = 3; d <= 5; d++) for (let dx = -d; dx <= d + 1; dx++) if (g.map.isFree(m.x + dx, m.y - d) && g.map.terrain[g.map.idx(m.x + dx, m.y - d)] !== 2) return { x: m.x + dx, y: m.y - d };
        return null;
      }, village);
      const vScreen = (tx, ty) => vp.evaluate(([x, y]) => {
        const cam = window.colonia.renderer.camera;
        const wx = (x + 0.5 - (y + 0.5)) * 32;
        const wy = (x + 0.5 + (y + 0.5)) * 16;
        const r = window.colonia.canvas.getBoundingClientRect();
        return { x: r.left + ((wx - cam.x) * cam.scale) / cam.dpr, y: r.top + ((wy - cam.y) * cam.scale) / cam.dpr };
      }, [tx, ty]);
      let attack = null;
      if (spot) {
        await vp.evaluate(() => window.colonia.ui.selectTool('garden'));
        const p = await vScreen(spot.x, spot.y);
        await vp.mouse.move(p.x, p.y);
        await vp.waitForTimeout(150);
        const warn = await vp.evaluate(() => document.querySelector('#sidebar')?.textContent || document.body.textContent);
        await vp.mouse.click(p.x, p.y);
        attack = await vp.evaluate(({ x, y }) => {
          const app = window.colonia;
          const g = app.game;
          app.ui.selectTool(null);
          const placed = !!g.map.building[g.map.idx(x, y)];
          const before = g.city.natives.attacks;
          g.runDays(1);
          return { placed, before, after: g.city.natives.attacks, villagers: [...g.units.values()].filter((u) => u.side === 'native').length };
        }, spot);
        attack.warned = /Native land/.test(warn);
      }
      check('a garden put with the mouse on an angry village\'s land (warned as it is placed) sets off an attack: villagers come out',
        !!attack && attack.placed && attack.warned && attack.after === attack.before + 1 && attack.villagers > 0, JSON.stringify({ spot, attack }));
      await vp.selectOption('select.hud-select', 'natives').catch(() => {});
      for (let t = 0; t < 4; t++) {
        await vp.keyboard.press('q');
        await vp.waitForTimeout(150);
      }
      const ov = await vp.evaluate(() => window.colonia.renderer.overlay?.key);
      check('the Native land overlay and the village draw at every view turn without an error', ov === 'natives' && verrors.length === 0, JSON.stringify({ ov, verrors }));
    }
    await vp.close();
  }

  // 6e. A low bridge (sim/bridges.js) dragged across the river with the
  //     mouse: its tiles are bridges no boat passes, its tile panel names
  //     it, and the city draws without an error at every view turn.
  {
    const bp = await ctx.newPage();
    const berrors = [];
    bp.on('pageerror', (e) => berrors.push(`pageerror: ${e.message}`));
    bp.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) berrors.push(m.text()); });
    await bp.goto(`${url}?skipmenu=1&maptype=river&map=small&seed=demo&mute=1&money=90000`);
    await bp.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 15000 });
    const crossing = await bp.evaluate(() => {
      const app = window.colonia;
      app.paused = true;
      app.renderer.camera.zoomIndex = 2;
      const g = app.game;
      const m = g.map;
      // The first straight east-west crossing of 2 to 8 water tiles a low bridge may take.
      for (let i = 0; i < m.size; i++) {
        const x = m.xOf(i);
        const y = m.yOf(i);
        if (x < 6 || y < 6 || x > m.w - 16 || y > m.h - 6 || m.isWater(x, y) || !m.isWater(x + 1, y)) continue;
        let n = 1;
        while (n <= 9 && m.isWater(x + n, y)) n++;
        if (n < 3 || n > 9) continue;
        const end = m.idx(x + n, y);
        if (m.terrain[i] === 3 || m.terrain[end] === 3 || m.building[i] || m.building[end] || m.wall[i] || m.wall[end]) continue; // (open land at both ends)
        app.renderer.camera.centerOnTile(x + n / 2, y);
        return { x, y, n };
      }
      return null;
    });
    check('a river crossing for the low bridge', !!crossing);
    if (crossing) {
      await bp.waitForTimeout(300);
      const bScreen = (tx, ty) => bp.evaluate(([x, y]) => {
        const cam = window.colonia.renderer.camera;
        const wx = (x + 0.5 - (y + 0.5)) * 32;
        const wy = (x + 0.5 + (y + 0.5)) * 16;
        const r = window.colonia.canvas.getBoundingClientRect();
        return { x: r.left + ((wx - cam.x) * cam.scale) / cam.dpr, y: r.top + ((wy - cam.y) * cam.scale) / cam.dpr };
      }, [tx, ty]);
      await bp.evaluate(() => window.colonia.ui.selectTool('low_bridge'));
      const a = await bScreen(crossing.x, crossing.y);
      const b = await bScreen(crossing.x + crossing.n, crossing.y);
      await bp.mouse.move(a.x, a.y);
      await bp.mouse.down();
      await bp.mouse.move(b.x, b.y, { steps: 8 });
      await bp.mouse.up();
      const built = await bp.evaluate(({ x, y, n }) => {
        const app = window.colonia;
        const m = app.game.map;
        const low = [];
        for (let k = 1; k < n; k++) low.push(m.bridgeLow[m.idx(x + k, y)] === 1 && m.road[m.idx(x + k, y)] === 3);
        app.ui.selectTool(null);
        app.ui.info.showTile(x + 1, y);
        return { low, panel: document.querySelector('#info-panel')?.textContent || '' };
      }, crossing);
      check('the Low Bridge tool lays a low bridge across the river, and its tile panel names it',
        built.low.length > 0 && built.low.every(Boolean) && /Pons Sublicius \(Low Bridge\)/.test(built.panel), JSON.stringify({ crossing, built: { low: built.low, panel: built.panel.slice(0, 160) } }));
      for (let t = 0; t < 4; t++) {
        await bp.keyboard.press('q');
        await bp.waitForTimeout(150);
      }
      check('the low bridge draws at every view turn without an error', berrors.length === 0, berrors.join(' | '));
    }
    // A ship bridge dragged across the river climbs from the road on ramps:
    // a walker set down where the ramp meets the water is drawn lifted a
    // third of the deck's height, one in the middle of the bank's road tile
    // not at all, and one a tile further on is up on the deck.
    const span = await bp.evaluate((low) => {
      const app = window.colonia;
      const m = app.game.map;
      // A straight east-west crossing of 3 to 8 water tiles, clear of the low bridge.
      for (let i = 0; i < m.size; i++) {
        const x = m.xOf(i);
        const y = m.yOf(i);
        if (x < 6 || y < 6 || x > m.w - 16 || y > m.h - 6 || (low && Math.abs(y - low.y) < 3) || m.isWater(x, y) || !m.isWater(x + 1, y)) continue;
        let n = 1;
        while (n <= 9 && m.isWater(x + n, y)) n++;
        if (n < 4 || n > 9) continue;
        const end = m.idx(x + n, y);
        if (m.terrain[i] === 3 || m.terrain[end] === 3 || m.building[i] || m.building[end] || m.wall[i] || m.wall[end] || m.road[i] || m.road[end]) continue;
        app.renderer.camera.centerOnTile(x + n / 2, y);
        return { x, y, n };
      }
      return null;
    }, crossing);
    if (span) {
      await bp.waitForTimeout(200);
      const toScreen = (tx, ty) => bp.evaluate(([x, y]) => {
        const cam = window.colonia.renderer.camera;
        const r = window.colonia.canvas.getBoundingClientRect();
        return { x: r.left + (((x - y) * 32 - cam.x) * cam.scale) / cam.dpr, y: r.top + (((x + y + 1) * 16 - cam.y) * cam.scale) / cam.dpr };
      }, [tx, ty]);
      await bp.evaluate(() => window.colonia.ui.selectTool('bridge'));
      const a = await toScreen(span.x, span.y);
      const b = await toScreen(span.x + span.n, span.y);
      await bp.mouse.move(a.x, a.y);
      await bp.mouse.down();
      await bp.mouse.move(b.x, b.y, { steps: 8 });
      await bp.mouse.up();
      await bp.evaluate(() => window.colonia.ui.selectTool(null));
    }
    const ramp = await bp.evaluate(() => {
      const app = window.colonia;
      const g = app.game;
      const m = g.map;
      const plainRoad = (x, y) => m.inBounds(x, y) && m.road[m.idx(x, y)] === 1 && !m.isWater(x, y) && !m.building[m.idx(x, y)] && !m.wall[m.idx(x, y)] && !m.aqueduct[m.idx(x, y)] && !m.roadblock[m.idx(x, y)];
      const ship = (x, y) => m.inBounds(x, y) && m.road[m.idx(x, y)] === 3 && !m.bridgeLow[m.idx(x, y)];
      let spot = null;
      for (let i = 0; i < m.size && !spot; i++) {
        const x = m.xOf(i);
        const y = m.yOf(i);
        if (!ship(x, y)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          // The bank's road tile at (x + dx, y + dy), the bridge running on to (x - dx, y - dy).
          if (plainRoad(x + dx, y + dy) && ship(x - dx, y - dy) && ship(x - 2 * dx, y - 2 * dy)) { spot = { x, y, dx, dy }; break; }
        }
      }
      if (!spot) return null;
      const r = app.renderer;
      r.setViewTurn(0);
      r.camera.centerOnTile(spot.x, spot.y);
      const id = g.nextWalkerId++;
      const w = { id, type: 'prefect', kind: 'roamer', x: spot.x + spot.dx, y: spot.y + spot.dy, tx: spot.x, ty: spot.y, progress: 0, moving: true, speed: 0, state: 'roam', path: null, pathIndex: 0, origin: 0, target: 0, cargo: null, people: 0, lastDir: -1, walked: 0, anim: 0, dead: false };
      g.walkers.set(id, w);
      const lifts = [];
      const picks = [];
      for (const [p, sx, sy] of [[0, w.x, w.y], [0.5, w.x, w.y], [0.5, spot.x, spot.y]]) {
        w.x = sx; w.y = sy;
        w.tx = sx - spot.dx; w.ty = sy - spot.dy;
        w.progress = p;
        r.render(0, 0.016);
        const s = r.walkerSpots.find((q) => q.id === id);
        // Its feet on the ground, unturned: (x + y) * 16 from the middle of its spot.
        const fx = w.x + (w.tx - w.x) * p + 0.5;
        const fy = w.y + (w.ty - w.y) * p + 0.5;
        lifts.push(s ? Math.round((fx + fy) * 16 - s.wy) : null);
        // A click on its body picks it, up on the ramp and the deck as on the road.
        const q = s ? r.camera.toScreen(s.wx, s.wy - 9) : null;
        picks.push(!!q && r.pickWalker(q.x / r.camera.dpr, q.y / r.camera.dpr) === id);
      }
      g.walkers.delete(id);
      return { spot, lifts, picks };
    });
    check('a walker on the ship bridge\'s ramp is drawn lifted onto it (none in the middle of the bank\'s road, a third up at the water, the deck a tile on), and a click on it picks it',
      !!ramp && ramp.lifts[0] === 0 && ramp.lifts[1] === 11 && ramp.lifts[2] === 33 && ramp.picks.every(Boolean), JSON.stringify({ span, ramp }));
    await bp.close();
  }

  // 6e2. Gardens fade untended (sim/gardens.js), on a page of its own so
  //      the main game's map and days stay as they were (the garrison
  //      check needs its room): on the demo city, a Topiaria (Gardeners'
  //      Yard) and a garden picked from the build menu and placed with the
  //      mouse beside a street of homes; the yard sends out its gardener; a
  //      garden left untended says so in its panel, and the Gardens and
  //      statues overlay opens with its legend.
  {
    const gp = await ctx.newPage();
    const gerrors = [];
    gp.on('pageerror', (e) => gerrors.push(`pageerror: ${e.message}`));
    gp.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) gerrors.push(m.text()); });
    await gp.goto(`${url}?skipmenu=1&map=small&seed=demo&mute=1&money=90000`);
    await gp.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 15000 });
    const yardAt = await gp.evaluate(() => {
      const app = window.colonia;
      app.paused = true;
      app.renderer.camera.zoomIndex = 2;
      app.ui.console.run('demo 2');
      const g = app.game;
      g.runDays(60); // people in the homes, for the yard's workers
      const m = g.map;
      const free = (x, y) => m.inBounds(x, y) && m.isFree(x, y) && m.terrain[m.idx(x, y)] !== 2;
      for (const h of g.buildings.values()) {
        if (!h.house || !(h.house.pop > 0) || h.accessRoad < 0) continue;
        const rx = m.xOf(h.accessRoad);
        const ry = m.yOf(h.accessRoad);
        // A free tile beside the home's street for the yard, and another
        // within 2 tiles of that street for the garden.
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const yard = { x: rx + dx, y: ry + dy };
          if (!free(yard.x, yard.y)) continue;
          for (let gy = ry - 2; gy <= ry + 2; gy++) {
            for (let gx = rx - 2; gx <= rx + 2; gx++) {
              if ((gx === yard.x && gy === yard.y) || !free(gx, gy)) continue;
              app.renderer.camera.centerOnTile(rx, ry);
              app.renderer.render(0, 0.016);
              return { yard, garden: { x: gx, y: gy } };
            }
          }
        }
      }
      return null;
    });
    check('the demo city has a street of homes with room for a gardeners\' yard and a garden', !!yardAt);
    if (yardAt) {
      await gp.waitForTimeout(300);
      const gScreen = (tx, ty) => gp.evaluate(([x, y]) => {
        const cam = window.colonia.renderer.camera;
        const wx = (x + 0.5 - (y + 0.5)) * 32;
        const wy = (x + 0.5 + (y + 0.5)) * 16;
        const r = window.colonia.canvas.getBoundingClientRect();
        return { x: r.left + ((wx - cam.x) * cam.scale) / cam.dpr, y: r.top + ((wy - cam.y) * cam.scale) / cam.dpr };
      }, [tx, ty]);
      const placed = {};
      for (const key of ['gardener_yard', 'garden']) {
        await gp.click('.cat-btn[title^="Government"]');
        const listed = await gp.isVisible(`.build-item[data-key="${key}"]`);
        if (listed) await gp.click(`.build-item[data-key="${key}"]`);
        const tool = await gp.evaluate(() => window.colonia.input.tool);
        const at = key === 'garden' ? yardAt.garden : yardAt.yard;
        if (tool === key) {
          const p = await gScreen(at.x, at.y);
          await gp.mouse.move(p.x - 4, p.y);
          await gp.mouse.move(p.x, p.y);
          await gp.waitForTimeout(100);
          await gp.mouse.click(p.x, p.y);
        }
        if (await gp.evaluate(() => window.colonia.input.tool)) await gp.keyboard.press('Escape');
        placed[key] = { listed, tool, placed: await gp.evaluate(({ x, y, k }) => window.colonia.game.buildings.get(window.colonia.game.map.building[window.colonia.game.map.idx(x, y)])?.type === k, { ...at, k: key }) };
      }
      const tending = await gp.evaluate(({ yard, garden }) => {
        const app = window.colonia;
        const g = app.game;
        const y = g.buildings.get(g.map.building[g.map.idx(yard.x, yard.y)]);
        const b = g.buildings.get(g.map.building[g.map.idx(garden.x, garden.y)]);
        if (!y || !b) return null;
        let walker = false;
        for (let d = 0; d < 24 && !walker; d++) {
          g.runDays(1);
          walker = [...g.walkers.values()].some((w) => w.type === 'gardener' && w.origin === y.id);
        }
        // Left untended for 100 days: down to its floor.
        b.tendedDay = g.time.totalDays - 100;
        g.updateBuilding(b);
        app.ui.info.showBuilding(b.id);
        const text = document.querySelector('#info-panel')?.textContent || '';
        app.ui.info.close();
        return { walker, staff: y.workers, step: b.careStep, untended: /Care\s*Untended: bonus at 25%/.test(text), note: /Last tended 100 days ago/.test(text) };
      }, yardAt);
      await gp.selectOption('.hud-select', 'gardens');
      await gp.waitForTimeout(150);
      const legend = await gp.isVisible('#overlay-legend:has-text("Tended: its full desirability")');
      await gp.selectOption('.hud-select', 'none');
      check('a Topiaria and a garden are placed from the build menu; its gardener walks out; an untended garden says so; the Gardens overlay opens',
        placed.gardener_yard?.placed && placed.garden?.placed && tending?.walker && tending.step === 4 && tending.untended && tending.note && legend && gerrors.length === 0,
        JSON.stringify({ yardAt, placed, tending, legend, gerrors }));
    }
    await gp.close();
  }

  // 6e3. Monuments (sim/monuments.js), on a page of their own: a Basilica's
  //      site, a work camp beside it and a warehouse by the camp are picked
  //      from the build menu and placed with the mouse on the city's roads,
  //      and a well beside the camp; the other monuments are then greyed
  //      out; with clay and timber in the warehouse the camp's ox cart brings
  //      a load to the site, whose panel shows its stage and goods. Then the
  //      console finishes it, and the finished Basilica is drawn from all
  //      four sides without an error.
  {
    const mp = await ctx.newPage();
    const merrors = [];
    mp.on('pageerror', (e) => merrors.push(`pageerror: ${e.message}`));
    mp.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) merrors.push(m.text()); });
    await mp.goto(`${url}?skipmenu=1&map=small&maptype=plains&seed=demo&mute=1&money=90000`);
    await mp.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 15000 });
    const monAt = await mp.evaluate(() => {
      const app = window.colonia;
      app.paused = true;
      app.renderer.camera.zoomIndex = 1;
      app.ui.console.run('demo 2');
      const g = app.game;
      g.runDays(60); // people in the homes, for the camp's workers
      const m = g.map;
      const net = m.roadNet[m.idx(m.entry.x, m.entry.y)];
      const taken = [];
      const clear = (x, y, S) => {
        for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) if (!m.inBounds(x + dx, y + dy) || !m.isFree(x + dx, y + dy) || m.terrain[m.idx(x + dx, y + dy)] === 2) return false;
        return !taken.some((t) => x < t.x + t.S + 1 && x + S + 1 > t.x && y < t.y + t.S + 1 && y + S + 1 > t.y);
      };
      const onRoad = (x, y, S) => {
        for (let k = 0; k < S; k++) {
          for (const [tx, ty] of [[x + k, y - 1], [x + k, y + S], [x - 1, y + k], [x + S, y + k]]) {
            if (m.inBounds(tx, ty) && m.road[m.idx(tx, ty)] && m.roadNet[m.idx(tx, ty)] === net) return true;
          }
        }
        return false;
      };
      const near = (S, from, maxD) => {
        let best = null;
        for (let y = 1; y < m.h - S - 1; y++) {
          for (let x = 1; x < m.w - S - 1; x++) {
            const d = Math.hypot(x - from.x, y - from.y);
            if (d > maxD || (best && d >= best.d) || !clear(x, y, S) || !onRoad(x, y, S)) continue;
            best = { x, y, d, S };
          }
        }
        if (best) taken.push(best);
        return best;
      };
      const home = [...g.buildings.values()].find((b) => b.house && b.house.pop > 0);
      const site = home ? near(5, home, 40) : null;
      const camp = site ? near(3, site, 14) : null;
      const store = camp ? near(3, camp, 14) : null;
      if (!site || !camp || !store) return null;
      // A tile for a well within its reach of the camp (2 tiles), clear of the rest.
      const inside = (x, y) => taken.some((t) => x >= t.x && x < t.x + t.S && y >= t.y && y < t.y + t.S);
      let well = null;
      for (let y = camp.y - 2; y <= camp.y + 4 && !well; y++) {
        for (let x = camp.x - 2; x <= camp.x + 4 && !well; x++) {
          if (m.inBounds(x, y) && m.isFree(x, y) && m.terrain[m.idx(x, y)] !== 2 && !inside(x, y)) well = { x, y, ax: x, ay: y };
        }
      }
      if (!well) return null;
      return { site: { x: site.x, y: site.y, ax: site.x + 2, ay: site.y + 2 }, camp: { x: camp.x, y: camp.y, ax: camp.x + 1, ay: camp.y + 1 }, store: { x: store.x, y: store.y, ax: store.x + 1, ay: store.y + 1 }, well };
    });
    check('the demo city has room on its roads for a monument\'s site, a work camp and a warehouse', !!monAt);
    if (monAt) {
      const mScreen = (tx, ty) => mp.evaluate(([x, y]) => {
        const app = window.colonia;
        const cam = app.renderer.camera;
        const wx = (x + 0.5 - (y + 0.5)) * 32;
        const wy = (x + 0.5 + (y + 0.5)) * 16;
        const r = app.canvas.getBoundingClientRect();
        return { x: r.left + ((wx - cam.x) * cam.scale) / cam.dpr, y: r.top + ((wy - cam.y) * cam.scale) / cam.dpr };
      }, [tx, ty]);
      const placeFromMenu = async (cat, key, at) => {
        await mp.evaluate(({ ax, ay }) => { const app = window.colonia; app.renderer.camera.centerOnTile(ax, ay); app.renderer.render(0, 0.016); }, at);
        await mp.click(`.cat-btn[title^="${cat}"]`);
        const listed = await mp.isVisible(`.build-item[data-key="${key}"]`);
        if (listed) await mp.click(`.build-item[data-key="${key}"]`);
        const tool = await mp.evaluate(() => window.colonia.input.tool);
        if (tool === key) {
          const p = await mScreen(at.ax, at.ay);
          await mp.mouse.move(p.x - 4, p.y);
          await mp.mouse.move(p.x, p.y);
          await mp.waitForTimeout(100);
          await mp.mouse.click(p.x, p.y);
        }
        if (await mp.evaluate(() => window.colonia.input.tool)) await mp.keyboard.press('Escape');
        const placed = await mp.evaluate(({ x, y, k }) => {
          const g = window.colonia.game;
          const b = g.buildings.get(g.map.building[g.map.idx(x, y)]);
          return !!b && b.type === k && b.x === x && b.y === y;
        }, { ...at, k: key });
        return { listed, tool, placed };
      };
      const sitePlaced = await placeFromMenu('Monuments', 'basilica', monAt.site);
      const greyed = await mp.evaluate(() => {
        const el = document.querySelector('.build-item[data-key="thermae"]');
        return { locked: !!el && el.classList.contains('locked'), why: el ? el.title : '' };
      });
      const campPlaced = await placeFromMenu('Monuments', 'work_camp', monAt.camp);
      const storePlaced = await placeFromMenu('Storage', 'warehouse', monAt.store);
      const wellPlaced = await placeFromMenu('Water', 'well', monAt.well); // (no road needed: it waters the camp)
      check('a Basilica\'s site and a Castra Operarum are picked from the Monuments menu and placed; the other monuments are greyed out, saying why',
        sitePlaced.listed && sitePlaced.placed && campPlaced.listed && campPlaced.placed && storePlaced.placed && wellPlaced.placed && greyed.locked && /one monument: the Basilica/.test(greyed.why) && merrors.length === 0,
        JSON.stringify({ monAt, sitePlaced, campPlaced, storePlaced, wellPlaced, greyed, merrors }));
      const hauled = await mp.evaluate(({ site, camp, store }) => {
        const app = window.colonia;
        const g = app.game;
        const at = (p) => g.buildings.get(g.map.building[g.map.idx(p.x, p.y)]);
        const s = at(site);
        const c = at(camp);
        const wh = at(store);
        if (!s || !c || !wh) return null;
        wh.stock.clay = 1000;
        wh.stock.timber = 400;
        const out = { cart: false, got: 0 };
        for (let d = 0; d < 80 && !(out.got > 0); d++) {
          g.runDays(1);
          out.cart ||= c.walkers.some((id) => g.walkers.get(id)?.state === 'campHaul');
          out.got = Object.values(s.mon.got).reduce((a, n) => a + n, 0);
        }
        out.camp = { staff: c.workers, water: c.camp.water, fed: c.camp.fed };
        app.ui.info.showBuilding(s.id);
        out.panel = document.querySelector('#info-panel')?.textContent || '';
        app.ui.info.close();
        return out;
      }, monAt);
      check('the work camp\'s ox cart brings a load from the warehouse to the site, whose panel shows its stage and goods',
        !!hauled && hauled.cart && hauled.got > 0 && /Stage 1 of 4: Fundamenta/.test(hauled.panel) && /Clay/.test(hauled.panel) && /Halt construction/.test(hauled.panel) && merrors.length === 0,
        JSON.stringify({ ...hauled, panel: (hauled?.panel || '').slice(0, 240), merrors }));
      const drawn = await mp.evaluate(({ site }) => {
        const app = window.colonia;
        const g = app.game;
        const reply = app.ui.console.run('monument basilica done');
        const b = g.buildings.get(g.map.building[g.map.idx(site.x, site.y)]);
        const out = { reply, finished: !!b && b.mon.stage === 4, turns: [] };
        for (let t = 0; t < 4; t++) {
          app.renderer.camera.setTurn(t);
          app.renderer.camera.centerOnTile(site.x + 2, site.y + 2);
          app.renderer.render(0, 0.016);
          out.turns.push(app.renderer.camera.turn);
        }
        app.renderer.camera.setTurn(0);
        app.ui.info.showBuilding(b.id);
        out.panel = document.querySelector('#info-panel')?.textContent || '';
        app.ui.info.close();
        return out;
      }, monAt);
      if (shots) await mp.screenshot({ path: path.join(shots, 'smoke-monument.png') });
      check('a finished monument is drawn from all four sides without an error, and its panel says what it does',
        drawn.finished && drawn.turns.join() === '0,1,2,3' && /prosperity rises by 8/.test(drawn.panel) && merrors.length === 0,
        JSON.stringify({ ...drawn, panel: drawn.panel.slice(0, 200), merrors }));
    }
    await mp.close();
  }

  // 6d2. Peoples and wolves (data/peoples.js, sim/wildlife.js): a sandbox at
  //      Narbo Martius set to the province's own people and with wolves:
  //      the Cimbri raid it and packs roam its woods; a click on a wolf and
  //      on a warrior opens their panels, which name the pack and the people.
  {
    const sp = await browser.newPage();
    const serrors = [];
    sp.on('pageerror', (e) => serrors.push(e.message));
    await sp.goto(`${url}?mute=1`);
    await sp.click('text=Sandbox');
    await sp.selectOption('select.site-select', 'narbo');
    await sp.selectOption('select.raiders-select', 'site');
    const raidersSay = await sp.textContent('select.raiders-select + div');
    await sp.check('input.wolves-check');
    await sp.click('text=Found the city');
    await sp.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 15000 });
    const setup = await sp.evaluate(() => {
      const app = window.colonia;
      app.paused = true;
      const g = app.game;
      // A warband of the province's people now, set down well inside the map so it can be clicked.
      app.ui.console.run('invade 6');
      const m = g.map;
      for (const u of g.units.values()) if (u.side === 'enemy') { u.x = u.px = m.w / 2 + 0.5 + (u.id % 3); u.y = u.py = m.h / 2 + 0.5 + (u.id % 2); }
      return {
        people: g.military.people, raid: g.military.active?.people, scenario: { raiders: g.scenario.raiders, wolves: g.scenario.wolves },
        packs: g.wildlife.packs.length, wolves: [...g.units.values()].filter((u) => u.type === 'wolf').length,
        kinds: [...new Set([...g.units.values()].filter((u) => u.side === 'enemy').map((u) => u.type))],
        threat: document.querySelector('.hud-btn.threat')?.title || '',
      };
    });
    check('sandbox at Narbo with its own people and wolves: the setup names the Cimbri, they raid, and packs roam the woods',
      /Cimbri and Teutones/.test(raidersSay) && setup.people === 'cimbri' && setup.raid === 'cimbri' && setup.scenario.raiders === 'site' && setup.scenario.wolves === true
        && setup.packs >= 1 && setup.wolves >= 6 && setup.kinds.every((t) => ['swordsman', 'axeman', 'raider', 'horseman'].includes(t)) && serrors.length === 0,
      JSON.stringify({ raidersSay, setup, serrors }));
    // Click a unit of `type`: the camera on it, its drawn spot, and a click there.
    const clickUnit = async (type) => {
      await sp.evaluate((t) => {
        const app = window.colonia;
        const u = [...app.game.units.values()].find((v) => v.type === t || (t === 'enemy' && v.side === 'enemy'));
        if (u) app.renderer.camera.centerOnTile(Math.floor(u.x), Math.floor(u.y));
      }, type);
      await sp.waitForTimeout(250);
      const at = await sp.evaluate((t) => {
        const app = window.colonia;
        const r = app.renderer;
        const cam = r.camera;
        const rect = app.canvas.getBoundingClientRect();
        for (const s of r.unitSpots) {
          const u = app.game.units.get(s.id);
          if (!u || !(u.type === t || (t === 'enemy' && u.side === 'enemy'))) continue;
          const q = cam.toScreen(s.wx, s.wy - 8);
          const x = rect.left + q.x / cam.dpr;
          const y = rect.top + q.y / cam.dpr;
          if (r.pickUnit(x - rect.left, y - rect.top) !== s.id) continue;
          return { id: s.id, x, y };
        }
        return null;
      }, type);
      if (!at) return { at };
      await sp.mouse.click(at.x, at.y);
      await sp.waitForTimeout(150);
      return { at, ...(await sp.evaluate(() => ({ target: window.colonia.ui.info.target, head: document.querySelector('#info-panel h3')?.textContent || '', chip: document.querySelector('#info-panel .panel-head .chip')?.textContent || '', text: document.querySelector('#info-panel')?.textContent || '' }))) };
    };
    const wolf = await clickUnit('wolf');
    check('clicking a wolf opens its panel: a wild animal, its pack and its bite', !!wolf.at && wolf.target?.kind === 'unit' && wolf.target.id === wolf.at.id && wolf.head === 'Wolf' && wolf.chip === 'Wild animal' && /Pack/.test(wolf.text) && /Bite/.test(wolf.text) && serrors.length === 0, JSON.stringify({ ...wolf, text: (wolf.text || '').slice(0, 200) }));
    const raider = await clickUnit('enemy');
    check('clicking a raiding warrior opens his panel, naming his people and what the warband is after', !!raider.at && raider.target?.kind === 'unit' && raider.chip === 'Cimbri and Teutones' && /Warband/.test(raider.text) && serrors.length === 0, JSON.stringify({ ...raider, text: (raider.text || '').slice(0, 200) }));
    await sp.close();
  }

  // 6f. Clicks on figures by buildings: a recruit training at the Military
  //     Academy, standing in plain view by its corner, could not be clicked
  //     (a building hid whatever stood within a box as tall as its sprite).
  //     Then forts at rest: their men stand in the yard, inside the walls,
  //     and a click on one there opens his panel.
  {
    const mp = await browser.newPage({ viewport: { width: 1366, height: 820 } });
    const merrors = [];
    mp.on('pageerror', (e) => merrors.push(`pageerror: ${e.message}`));
    mp.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) merrors.push(m.text()); });
    await mp.goto(`${url}?skipmenu=1&seed=fp1&mute=1`);
    await mp.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 15000 });
    const rec = await mp.evaluate(() => {
      const app = window.colonia;
      app.paused = true;
      const c = app.ui.console;
      c.run('demo 2');
      c.run('garrison');
      c.run('academy');
      let w = null;
      for (let d = 0; d < 160 && !w; d++) {
        c.run('days 1');
        w = [...app.game.walkers.values()].find((v) => v.type === 'recruit' && v.state === 'training');
      }
      if (w) app.renderer.camera.centerOnTile(w.x, w.y);
      return w ? { id: w.id, x: w.x, y: w.y } : null;
    });
    // A click on his body, a few pixels above his feet, after a frame has drawn him.
    const figureAt = (id, kind) => mp.evaluate(([id, kind]) => {
      const app = window.colonia;
      const r = app.renderer;
      const cam = r.camera;
      const s = (kind === 'unit' ? r.unitSpots : r.walkerSpots).find((v) => v.id === id);
      if (!s) return null;
      const q = cam.toScreen(s.wx, s.wy - 8);
      const rect = app.canvas.getBoundingClientRect();
      return { x: rect.left + q.x / cam.dpr, y: rect.top + q.y / cam.dpr };
    }, [id, kind]);
    const panelOf = () => mp.evaluate(() => ({ target: window.colonia.ui.info.target, text: document.querySelector('#info-panel')?.textContent || '' }));
    let recClick = null;
    if (rec) {
      await mp.waitForTimeout(300);
      const p = await figureAt(rec.id, 'walker');
      if (p) {
        await mp.mouse.click(p.x, p.y);
        await mp.waitForTimeout(150);
        recClick = await panelOf();
      }
    }
    check('a recruit training at the Military Academy, beside its corner, opens his panel when clicked', !!rec && recClick?.target?.kind === 'walker' && recClick.target.id === rec.id && /Recruit/i.test(recClick.text) && merrors.length === 0,
      JSON.stringify({ rec, target: recClick?.target, text: (recClick?.text || '').slice(0, 120), merrors }));
    // The forts' men at rest: in their yards, and clickable there.
    const yard = await mp.evaluate(() => {
      const app = window.colonia;
      app.ui.info.close();
      app.ui.console.run('days 90');
      const g = app.game;
      const inside = (u) => { const f = g.buildings.get(u.fort); return !!f && u.x >= f.x && u.y >= f.y && u.x < f.x + f.size && u.y < f.y + f.size; };
      const idle = [...g.units.values()].filter((u) => u.side === 'rome' && u.fort && u.state === 'idle');
      const man = idle.find(inside);
      if (man) { const f = g.buildings.get(man.fort); app.renderer.camera.centerOnTile(f.x + 1, f.y + 1); }
      return { idle: idle.length, inside: idle.filter(inside).length, id: man ? man.id : 0 };
    });
    check('forts at rest: every idle soldier stands in his fort\'s yard, inside its walls', yard.idle > 0 && yard.inside === yard.idle, JSON.stringify(yard));
    let manClick = null;
    if (yard.id) {
      await mp.waitForTimeout(300);
      // A man the pointer picks on his own body (in a tight yard a neighbour's box may be nearer).
      const pick = await mp.evaluate((fortOf) => {
        const app = window.colonia;
        const r = app.renderer;
        const cam = r.camera;
        const rect = app.canvas.getBoundingClientRect();
        for (const s of r.unitSpots) {
          const u = app.game.units.get(s.id);
          if (!u || u.fort !== fortOf) continue;
          const q = cam.toScreen(s.wx, s.wy - 8);
          if (r.pickUnit(q.x / cam.dpr, q.y / cam.dpr) === s.id) return { id: s.id, x: rect.left + q.x / cam.dpr, y: rect.top + q.y / cam.dpr };
        }
        return null;
      }, await mp.evaluate((id) => window.colonia.game.units.get(id).fort, yard.id));
      if (pick) {
        await mp.mouse.click(pick.x, pick.y);
        await mp.waitForTimeout(150);
        manClick = { id: pick.id, ...(await panelOf()) };
      }
      if (shots) await mp.screenshot({ path: path.join(shots, 'smoke-fort-yard.png') });
    }
    check('a click on a soldier in his fort\'s yard opens his panel', !!manClick && manClick.target?.kind === 'unit' && manClick.target.id === manClick.id && merrors.length === 0,
      JSON.stringify({ id: manClick?.id, target: manClick?.target, text: (manClick?.text || '').slice(0, 120), merrors }));
    await mp.close();
  }

  // 6g. Forts full of untrained men, then an academy (a playtester's city):
  //     the men at rest go to train, one man of a fort at a time, and the
  //     fort's panel says who is at the Campus.
  {
    const tp = await browser.newPage({ viewport: { width: 1366, height: 820 } });
    const terrors = [];
    tp.on('pageerror', (e) => terrors.push(`pageerror: ${e.message}`));
    tp.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) terrors.push(m.text()); });
    await tp.goto(`${url}?skipmenu=1&seed=fp1&mute=1&raids=off`);
    await tp.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 15000 });
    const trips = await tp.evaluate(() => {
      const app = window.colonia;
      app.paused = true;
      const c = app.ui.console;
      const g = app.game;
      const inside = (u) => { const f = g.buildings.get(u.fort); return !!f && u.x >= f.x && u.y >= f.y && u.x < f.x + f.size && u.y < f.y + f.size; };
      const resting = () => [...g.units.values()].filter((u) => u.fort && !u.trained && u.state === 'idle' && inside(u));
      c.run('demo 2');
      c.run('garrison');
      let day = 0;
      for (; day < 200 && resting().length < 4; day++) c.run('days 1');
      const before = resting().length;
      c.run('academy');
      let most = 0;
      let first = null;
      for (let d = 0; d < 120 && !first; d++) {
        c.run('days 1');
        const out = new Map();
        for (const u of g.units.values()) if (u.fort && u.drill) out.set(u.fort, (out.get(u.fort) || 0) + 1);
        most = Math.max(most, ...out.values(), 0);
        first = [...g.units.values()].find((u) => u.fort && u.drill && u.state === 'training') || null;
      }
      if (!first) return { before, day, most };
      app.ui.info.showBuilding(first.fort);
      const fortText = document.querySelector('#info-panel')?.textContent || '';
      return { before, day, most, state: first.state, fortText: fortText.slice(fortText.indexOf('Training'), fortText.indexOf('Training') + 80) };
    });
    check('forts of untrained men and a new academy: one man of a fort at a time goes to train, and its panel says so', trips.before >= 4 && trips.state === 'training' && trips.most === 1 && /trained, 1 at the Campus/.test(trips.fortText || '') && terrors.length === 0,
      JSON.stringify({ ...trips, terrors }));
    await tp.close();
  }

  // 7. Phone layout: no horizontal scroll, sidebar becomes a bottom sheet
  const phone =await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const perrors = [];
  phone.on('pageerror', (e) => perrors.push(e.message));
  await phone.goto(`${url}?skipmenu=1&map=small&seed=phone`); // a map where the demo city gets a warehouse
  await phone.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 15000 });
  const layout = await phone.evaluate(() => {
    const sb = document.getElementById('sidebar').getBoundingClientRect();
    return { scrollW: document.documentElement.scrollWidth, w: window.innerWidth, sbTop: sb.top, sbH: sb.height };
  });
  check('phone: no horizontal scroll', layout.scrollW <= layout.w, `${layout.scrollW} <= ${layout.w}`);
  check('phone: build menu docked at the bottom', layout.sbTop > 400, `top ${Math.round(layout.sbTop)}`);
  if (shots) await phone.screenshot({ path: path.join(shots, 'smoke-phone.png') });
  // The warehouse panel fits a phone: no sideways scroll inside it, and a tap cycles an order.
  const phoneWh = await phone.evaluate(() => {
    const app = window.colonia;
    app.ui.console.run('demo 2');
    const wh = [...app.game.buildings.values()].find((b) => b.type === 'warehouse');
    if (!wh) return null;
    app.ui.info.showBuilding(wh.id);
    const panel = document.getElementById('info-panel');
    return { id: wh.id, scrollW: panel.scrollWidth, w: panel.clientWidth };
  });
  if (phoneWh) {
    await phone.tap('#info-panel .order-btn[data-good="oil"]');
    const oil = await phone.evaluate((id) => window.colonia.game.buildings.get(id).orders.oil, phoneWh.id);
    if (shots) await phone.screenshot({ path: path.join(shots, 'smoke-phone-warehouse.png') });
    check('phone: the warehouse panel fits, and a tap cycles an order', phoneWh.scrollW <= phoneWh.w && oil === 'refuse', JSON.stringify({ ...phoneWh, oil }));
  } else {
    check('phone: demo city has a warehouse', false);
  }
  // The Empire map on a phone: the compass opens it, the map fits the width
  // with the panel below it, and nothing scrolls sideways.
  await phone.tap('#hud-empire');
  await phone.waitForSelector('canvas.empire-full', { timeout: 3000 }).catch(() => {});
  await phone.waitForTimeout(200);
  const pe = await phone.evaluate(() => {
    const c = document.querySelector('canvas.empire-full');
    const side = document.querySelector('.empire-side');
    if (!c || !side) return null;
    const cr = c.getBoundingClientRect();
    return { w: Math.round(cr.width), right: Math.round(cr.right), vw: window.innerWidth, sideTop: Math.round(side.getBoundingClientRect().top), mapBottom: Math.round(cr.bottom), scrollW: document.documentElement.scrollWidth };
  });
  check('phone: the empire map opens from the top bar and fits the screen', !!pe && pe.w > 250 && pe.right <= pe.vw && pe.scrollW <= pe.vw && pe.sideTop >= pe.mapBottom, JSON.stringify(pe));
  if (shots) await phone.screenshot({ path: path.join(shots, 'smoke-phone-empire.png') });
  // The Health, Education and Entertainment advisors on a phone: each opens
  // with its table, nothing scrolls sideways, and the fourteen tabs leave the
  // page most of the window.
  await phone.keyboard.press('Escape');
  // In a wide font as well (Verdana, about as wide as Linux's defaults):
  // the Venues table fit here and ran 15 px over on the CI runner.
  const wideFont = await phone.addStyleTag({ content: '* { font-family: Verdana, "DejaVu Sans", sans-serif !important; }' });
  const phoneTabs = [];
  for (const tab of ['health', 'education', 'entertainment']) {
    phoneTabs.push(await phone.evaluate((t) => {
      window.colonia.ui.openAdvisors(t);
      const body = document.querySelector('.modal-body');
      const tabs = document.querySelector('.modal .tabs');
      return { tab: t, rows: body.querySelectorAll('tr[data-kind]').length, scrollW: body.scrollWidth, w: body.clientWidth, page: document.documentElement.scrollWidth, tabsH: Math.round(tabs.getBoundingClientRect().height) };
    }, tab));
    if (shots) await phone.screenshot({ path: path.join(shots, `smoke-phone-${tab}.png`) });
    await phone.keyboard.press('Escape');
  }
  // Every build menu list, and the inspect panel of the buildings with the
  // longest names, in the same wide font: the Latin name, the English under
  // it and the cost stay inside the list, and a title wraps rather than
  // pushing the panel sideways.
  const phoneNames = await phone.evaluate(() => {
    const app = window.colonia;
    const sb = app.ui.sidebar;
    const list = document.getElementById('build-list');
    const over = [];
    const was = sb.category;
    for (const cat of [...document.querySelectorAll('.cat-btn')].map((b) => b.title)) {
      document.querySelector(`.cat-btn[title="${cat}"]`).click(); // (a click renders the buttons anew)
      list.classList.remove('collapsed');
      const right = list.getBoundingClientRect().right;
      for (const item of list.querySelectorAll('.build-item')) {
        const r = item.getBoundingClientRect();
        const cost = item.querySelector('.cost').getBoundingClientRect();
        if (r.right > right + 0.5 || cost.right > r.right + 0.5 || item.scrollWidth > item.clientWidth) over.push(`${cat}:${item.dataset.key}`);
      }
    }
    sb.category = was;
    sb.renderCategories();
    sb.renderList();
    // The longest titles, in a building's panel (the demo city's warehouse,
    // its title row swapped for each): inside the panel, and on two lines at
    // most, the English one wrapping under the Latin as a whole.
    const panel = document.getElementById('info-panel');
    const heads = [];
    const wh = [...app.game.buildings.values()].find((x) => x.type === 'warehouse');
    if (wh) {
      app.ui.info.showBuilding(wh.id);
      const title = (name, en) => {
        panel.querySelector('.panel-head').replaceWith(app.ui.info.head(name, '3×3', en));
        return panel.querySelector('h3');
      };
      const oneLine = title('Forum', 'Forum').getBoundingClientRect().height;
      for (const [name, en] of [['Templum Mercurii', 'Grand Temple of Mercury'], ['Officina Sagittaria', 'Fletcher'], ['Taberna Vestiaria', 'Clothing Maker'], ['Ludus Gladiatorius', 'Gladiator School'], ['Praetorium Maius', "Governor's Villa"], ['Collegium Fabrum', "Engineer's Post"], ['Castellum Aquae', 'Reservoir']]) {
        const h3 = title(name, en);
        const r = h3.getBoundingClientRect();
        heads.push({ name, lines: Math.round(r.height / oneLine), fits: panel.scrollWidth <= panel.clientWidth && r.right <= panel.getBoundingClientRect().right });
      }
      app.ui.info.close();
    }
    return { over, items: list.querySelectorAll('.build-item').length, heads };
  });
  await wideFont.evaluate((el) => el.remove());
  check('phone: long Latin names fit every build menu list, and in two lines at most the inspect panel\'s title', phoneNames.over.length === 0 && phoneNames.heads.length === 7 && phoneNames.heads.every((x) => x.fits && x.lines <= 2), JSON.stringify(phoneNames));
  check('phone: the Health, Education and Entertainment advisors open and fit the width', phoneTabs.every((t) => t.rows >= 3 && t.scrollW <= t.w && t.page <= 390 && t.tabsH < 120), JSON.stringify(phoneTabs));
  // The campaign list on a phone: ten steps, the two provinces of a step
  // stacked, every button inside the width and nothing scrolling sideways.
  await phone.evaluate(() => window.colonia.toMainMenu());
  await phone.waitForSelector('.menu-card');
  await phone.tap('.menu-card button:has-text("Campaign")');
  await phone.waitForSelector('.modal .scenario-step');
  const phoneCampaign = await phone.evaluate(() => {
    const rows = [...document.querySelectorAll('.scenario-step')];
    const body = document.querySelector('.modal-body');
    const right = body.getBoundingClientRect().right;
    const buttons = [...document.querySelectorAll('.scenario-step button.scenario')];
    const stacked = rows.filter((r) => r.querySelectorAll('button.scenario').length === 2).every((r) => {
      const [a, b] = [...r.querySelectorAll('button.scenario')].map((x) => x.getBoundingClientRect());
      return b.top >= a.bottom - 1;
    });
    return { rows: rows.length, stacked, inside: buttons.every((x) => x.getBoundingClientRect().right <= right + 0.5), scrollW: body.scrollWidth, w: body.clientWidth, page: document.documentElement.scrollWidth };
  });
  if (shots) await phone.screenshot({ path: path.join(shots, 'smoke-phone-campaign.png') });
  check('phone: the campaign list shows ten steps, siblings stacked, inside the width', phoneCampaign.rows === 10 && phoneCampaign.stacked && phoneCampaign.inside && phoneCampaign.scrollW <= phoneCampaign.w && phoneCampaign.page <= 390, JSON.stringify(phoneCampaign));
  check('phone: no page errors', perrors.length === 0, perrors.join(' | '));
  // 7b. Phone main menu: ONE tap on the title gate starts the music. Nothing
  //     may query the page before the tap: Playwright's evaluate() counts as a
  //     user gesture and would hide a missing touch unlock.
  const tapPage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await tapPage.goto(url);
  await tapPage.waitForTimeout(2500);
  await tapPage.touchscreen.tap(195, 422);
  await tapPage.waitForTimeout(800);
  const tapped = await tapPage.evaluate(() => ({ ctx: window.colonia.sfx.ctx && window.colonia.sfx.ctx.state, playing: window.colonia.music.playing, mood: window.colonia.music.mood, gate: !!document.querySelector('#title-gate:not(.leaving)'), modal: !!document.querySelector('.modal') }));
  check('phone: one tap on the title gate starts the menu music', tapped.playing && tapped.mood === 'menu' && !tapped.gate && !tapped.modal, JSON.stringify(tapped));
  await tapPage.close();

  // 7c. Fullscreen (ui/fullscreen.js): with the setting off, starting a game asks for nothing;
  //     the top bar's button asks; an Esc that just left fullscreen does nothing else, the next
  //     opens the game menu; and a new window size (as entering or leaving fullscreen gives)
  //     resizes the canvas and the camera. (Headless pages are not truly made fullscreen: the
  //     requests are recorded.)
  {
    const fp = await ctx.newPage();
    const ferrors = [];
    fp.on('pageerror', (e) => ferrors.push(`pageerror: ${e.message}`));
    await fp.goto(url);
    await fp.waitForSelector('#title-gate', { timeout: 15000 });
    await fp.click('#title-gate');
    await fp.waitForTimeout(500);
    await fp.evaluate(() => {
      window.colonia.settings.fullscreen = false;
      window.__fsAsks = 0;
      document.documentElement.requestFullscreen = function () { window.__fsAsks++; return Promise.resolve(); };
    });
    await fp.click('text=Sandbox');
    await fp.click('text=Found the city');
    await fp.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 15000 });
    const offAsks = await fp.evaluate(() => window.__fsAsks);
    check('with Settings > Fullscreen when a game starts off, Found the city asks for no fullscreen', offAsks === 0, String(offAsks));
    const btnShown = await fp.isVisible('#hud-fullscreen');
    await fp.click('#hud-fullscreen');
    const btnAsks = await fp.evaluate(() => window.__fsAsks);
    check('the top bar\'s fullscreen button asks for fullscreen', btnShown && btnAsks === 1, JSON.stringify({ btnShown, btnAsks }));
    await fp.mouse.move(600, 400);
    await fp.evaluate(() => { window.colonia.fullscreenLeftAt = performance.now(); });
    await fp.keyboard.press('Escape');
    const afterLeave = await fp.evaluate(() => !!document.querySelector('.modal'));
    await fp.waitForTimeout(500);
    await fp.keyboard.press('Escape');
    const afterNext = await fp.evaluate(() => !!document.querySelector('.modal'));
    check('the Esc that left fullscreen does nothing else; the next Esc opens the game menu', !afterLeave && afterNext, JSON.stringify({ afterLeave, afterNext }));
    const menuFs = await fp.isVisible('.modal .btn:has-text("Fullscreen")');
    check('the game menu has a Fullscreen button', menuFs);
    await fp.keyboard.press('Escape');
    const sizeOf = () => fp.evaluate(() => {
      const app = window.colonia;
      const r = app.renderer;
      const box = r.canvas.getBoundingClientRect();
      const side = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')) || 0;
      return { viewW: r.camera.viewW, viewH: r.camera.viewH, cssW: Math.round(box.width), cssH: Math.round(box.height), want: [innerWidth - side, innerHeight], dpr: r.camera.dpr };
    });
    await fp.setViewportSize({ width: 1500, height: 860 });
    await fp.evaluate(() => document.dispatchEvent(new Event('fullscreenchange')));
    await fp.waitForTimeout(200);
    const big = await sizeOf();
    check('a new window size (entering or leaving fullscreen) resizes the canvas and the camera', big.cssW === big.want[0] && big.cssH === big.want[1] && big.viewW === Math.round(big.cssW * big.dpr) && big.viewH === Math.round(big.cssH * big.dpr), JSON.stringify(big));
    check('fullscreen: no page errors', ferrors.length === 0, ferrors.join(' | '));
    await fp.close();
  }

  // 8. The WebGL renderer (beta, render3d/), on a browser of its own that is
  //    told to give WebGL without a GPU (SwiftShader): the demo city draws
  //    with it, the well as a 3D model, clicks still pick a building (the
  //    well by its footprint) and a walker, the view turns, a lost WebGL
  //    context hands the drawing to the Classic renderer until it is back,
  //    and Settings switches back to Classic.
  {
    const glBrowser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    try {
      const gp = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
      const gerrors = [];
      gp.on('pageerror', (e) => gerrors.push(`pageerror: ${e.message}`));
      gp.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) gerrors.push(m.text()); });
      await gp.goto(`${url}?skipmenu=1&map=small&seed=webgl3&mute=1&renderer=3d`);
      await gp.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 30000 });
      await gp.evaluate(() => { const app = window.colonia; app.ui.console.run('demo 2'); app.ui.console.run('days 30'); app.paused = true; });
      // Onto a well, with walkers about.
      const well = await gp.evaluate(() => {
        const app = window.colonia;
        const w = [...app.game.buildings.values()].find((b) => b.type === 'well');
        app.renderer.camera.zoomIndex = 3;
        app.renderer.camera.centerOnTile(w.x, w.y);
        return { id: w.id, x: w.x, y: w.y };
      });
      // (The first frames at a new zoom make its sprites and their textures: under a software GL that takes a while.)
      await gp.waitForFunction(() => window.colonia.renderer.stats.models > 0 && !window.colonia.renderer.stats.pending, null, { timeout: 15000 }).catch(() => {});
      const drawn = await gp.evaluate(() => {
        const r = window.colonia.renderer;
        // Is there a picture? Many colours in a sample of the composed picture (the WebGL
        // canvas and the 2D overlay over it: Renderer.composedImage), not one flat fill.
        const d = r.composedImage().data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 4 * 997) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        return { backend: r.stats.backend, objects: r.stats.objects, models: r.stats.models, drawCalls: r.stats.drawCalls, textures: r.stats.textures, colours: seen.size };
      });
      if (shots) await gp.screenshot({ path: path.join(shots, 'smoke-webgl.png') });
      check('WebGL renderer: ?renderer=3d draws the city with WebGL', drawn.backend === 'webgl' && drawn.objects > 50 && drawn.drawCalls > 0 && drawn.textures > 20 && drawn.colours > 50, JSON.stringify(drawn));
      check('WebGL renderer: the well is drawn as a 3D model', drawn.models >= 1, JSON.stringify(drawn));
      const onPage = (fx, fy) => gp.evaluate(([x, y]) => {
        const app = window.colonia;
        const cam = app.renderer.camera;
        const w = cam.mapToWorld(x, y);
        const r = app.canvas.getBoundingClientRect();
        return { x: r.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: r.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
      }, [fx, fy]);
      // A click on the well (a model: picked by its footprint), at every view turn.
      const picks = [];
      for (let t = 0; t < 4; t++) {
        await gp.evaluate((v) => { const app = window.colonia; app.ui.info.close(); app.renderer.camera.centerOnTile(v.x, v.y); }, well);
        await gp.waitForTimeout(150);
        const p = await onPage(well.x + 0.5, well.y + 0.5);
        await gp.mouse.click(p.x, p.y);
        await gp.waitForTimeout(150);
        picks.push(await gp.evaluate(() => ({ turn: window.colonia.renderer.camera.turn, target: window.colonia.ui.info.target, models: window.colonia.renderer.stats.models, backend: window.colonia.renderer.stats.backend })));
        if (shots) await gp.screenshot({ path: path.join(shots, `smoke-webgl-turn${t}.png`) });
        await gp.evaluate(() => window.colonia.ui.info.close());
        await gp.mouse.move(300, 12);
        await gp.keyboard.press('q');
        await gp.waitForTimeout(150);
      }
      check('WebGL renderer: at every view turn the well is a model and a click on it opens its panel', picks.every((o, t) => o.turn === t && o.models >= 1 && o.backend === 'webgl' && o.target?.kind === 'building' && o.target.id === well.id), JSON.stringify(picks));
      // A fountain drawn as a model (render3d/models/fountain.js), its look following its
      // neighbourhood (render3d/fountainTier.js), and a click on it picks it.
      const fnt = await gp.evaluate(() => {
        const app = window.colonia;
        const g = app.game;
        // (A fountain on an open tile beside a road near the well: drawn whatever its water.)
        const w = [...g.buildings.values()].find((b) => b.type === 'well');
        const before = new Set(g.buildings.keys());
        app.ui.selectTool('fountain');
        app.input.mouse.over = true;
        let found = null;
        for (let r = 1; r < 8 && !found; r++) {
          for (let dy = -r; dy <= r && !found; dy++) {
            for (let dx = -r; dx <= r && !found; dx++) {
              app.input.hover = { x: w.x + dx, y: w.y + dy };
              app.input.refreshPlan();
              const plan = app.renderer.plan;
              if (!plan || !plan.items.length || !plan.items.every((it) => it.ok) || plan.items.some((it) => it.noRoad)) continue;
              app.applyPlan(plan);
              const b = [...g.buildings.values()].find((x) => !before.has(x.id) && x.type === 'fountain');
              if (b) found = { id: b.id, x: b.x, y: b.y };
            }
          }
        }
        app.ui.selectTool(null);
        if (found) app.renderer.camera.centerOnTile(found.x, found.y);
        return found;
      });
      const shotFountain = async () => {
        await gp.waitForTimeout(700); // (the new building rises out of the ground for half a second)
        return gp.evaluate((f) => {
          const r = window.colonia.renderer;
          const be = r.backend;
          return { fountains: r.stats.modelPass?.byType?.fountain || 0, tier: be.models.tiers.get(f.id)?.t ?? null };
        }, fnt);
      };
      let fview = null;
      let fpick = null;
      let rich = null;
      if (fnt) {
        await gp.evaluate((f) => { const g = window.colonia.game; g.map.desirability[g.map.idx(f.x, f.y)] = 0; }, fnt);
        fview = await shotFountain();
        const p = await onPage(fnt.x + 0.5, fnt.y + 0.5);
        await gp.mouse.click(p.x, p.y);
        await gp.waitForTimeout(150);
        fpick = await gp.evaluate(() => window.colonia.ui.info.target);
        await gp.evaluate(() => window.colonia.ui.info.close());
        // A rich quarter: the finest look (the sim is paused; the renderer reads the layer each frame).
        await gp.evaluate((f) => { const g = window.colonia.game; g.map.desirability[g.map.idx(f.x, f.y)] = 60; }, fnt);
        rich = await shotFountain();
        if (shots) await gp.screenshot({ path: path.join(shots, 'smoke-webgl-fountain.png') });
      }
      check('WebGL renderer: a fountain is a 3D model, a click picks it, and its look follows its neighbourhood',
        !!fnt && fview.fountains >= 1 && fview.tier === 1 && fpick?.kind === 'building' && fpick.id === fnt.id && rich.tier === 4,
        JSON.stringify({ fnt, fview, fpick, rich }));
      // The aqueduct and the castellum (render3d/aqueducts/, models/aqueduct.js, castellum.js): an
      // aqueduct dragged over a straight road (its arch) from a reservoir placed at its west end;
      // drawn as 3D models, a click on an aqueduct tile picks the tile and one on the reservoir the
      // building. Cleared again, so the steps after see the city as it was.
      const aqWorks = await gp.evaluate(() => {
        const app = window.colonia;
        const g = app.game;
        const m = g.map;
        const free = (x, y) => m.inBounds(x, y) && m.isFree(x, y) && !m.isWater(x, y);
        let at = null;
        for (let i = 0; i < m.size && !at; i++) {
          const x = m.xOf(i);
          const y = m.yOf(i);
          if (m.road[i] !== 1 || m.building[i] || m.wall[i] || m.aqueduct[i] || !m.hasRoad(x, y - 1) || !m.hasRoad(x, y + 1) || m.hasRoad(x - 1, y) || m.hasRoad(x + 1, y)) continue;
          let ok = free(x + 1, y) && free(x + 2, y) && free(x - 1, y) && free(x - 2, y);
          for (let dx = -5; dx <= -3 && ok; dx++) for (let dy = -1; dy <= 1 && ok; dy++) ok = free(x + dx, y + dy);
          if (ok) at = { x, y };
        }
        if (!at) return null;
        at.free = g.cheats.freeBuild;
        g.cheats.freeBuild = true;
        app.ui.selectTool('reservoir');
        // (The hover plans only with the mouse over the map, as the fountain's step sets it: set here, not borrowed.)
        app.input.mouse.over = true;
        app.input.hover = { x: at.x - 4, y: at.y };
        app.input.refreshPlan();
        if (app.renderer.plan && app.renderer.plan.items.every((it) => it.ok)) app.applyPlan(app.renderer.plan);
        app.ui.selectTool('aqueduct');
        app.input.drag = { x0: at.x - 2, y0: at.y, x1: at.x + 2, y1: at.y };
        app.input.refreshPlan();
        app.applyPlan(app.renderer.plan);
        app.input.drag = null;
        app.ui.selectTool(null);
        const res = [...g.buildings.values()].find((b) => b.type === 'reservoir' && b.x === at.x - 5 && b.y === at.y - 1);
        app.renderer.camera.zoomIndex = 4;
        app.renderer.camera.centerOnTile(at.x - 1, at.y);
        let tiles = 0;
        for (let dx = -2; dx <= 2; dx++) if (m.aqueduct[m.idx(at.x + dx, at.y)]) tiles++;
        return { ...at, tiles, res: res ? res.id : null };
      });
      // Waiting for the state, not a time: kits are built within a frame's budget, slowly under a software GL.
      await gp.waitForFunction(() => {
        const by = window.colonia.renderer.stats.modelPass?.byType || {};
        return by.aqueduct >= 5 && by.reservoir >= 1;
      }, null, { timeout: 30000, polling: 100 }).catch(() => {});
      const aqDrawn = await gp.evaluate(() => ({ ...(window.colonia.renderer.stats.modelPass?.byType || {}) }));
      const aqPicks = {};
      if (aqWorks) {
        await gp.mouse.move(300, 12);
        let p = await onPage(aqWorks.x + 1.5, aqWorks.y + 0.5);
        await gp.mouse.click(p.x, p.y);
        await gp.waitForTimeout(150);
        aqPicks.aqueduct = await gp.evaluate(() => window.colonia.ui.info.target);
        await gp.evaluate(() => window.colonia.ui.info.close());
        p = await onPage(aqWorks.x - 3.5, aqWorks.y + 0.5);
        await gp.mouse.click(p.x, p.y);
        await gp.waitForTimeout(150);
        aqPicks.reservoir = await gp.evaluate(() => window.colonia.ui.info.target);
        await gp.evaluate(() => window.colonia.ui.info.close());
        if (shots) await gp.screenshot({ path: path.join(shots, 'smoke-webgl-aqueduct.png') });
        await gp.evaluate((at) => {
          const app = window.colonia;
          app.ui.selectTool('clear');
          for (const d of [{ x0: at.x - 2, y0: at.y, x1: at.x + 2, y1: at.y }, { x0: at.x - 5, y0: at.y - 1, x1: at.x - 3, y1: at.y + 1 }]) {
            app.input.drag = d;
            app.input.refreshPlan();
            if (app.renderer.plan) app.applyPlan(app.renderer.plan);
          }
          // (Clearing the road's arch takes its road with it: the road is laid again.)
          app.ui.selectTool('road');
          app.input.drag = { x0: at.x, y0: at.y, x1: at.x, y1: at.y };
          app.input.refreshPlan();
          if (app.renderer.plan) app.applyPlan(app.renderer.plan);
          app.input.drag = null;
          app.ui.selectTool(null);
          app.game.cheats.freeBuild = at.free;
        }, aqWorks);
      }
      check('WebGL renderer: an aqueduct over a road and a reservoir are 3D models; a click on the aqueduct picks its tile, on the reservoir the building',
        !!aqWorks && aqWorks.tiles === 5 && !!aqWorks.res && aqDrawn.aqueduct >= 5 && aqDrawn.reservoir >= 1
          && aqPicks.aqueduct?.kind === 'tile' && aqPicks.aqueduct.x === aqWorks.x + 1 && aqPicks.aqueduct.y === aqWorks.y
          && aqPicks.reservoir?.kind === 'building' && aqPicks.reservoir.id === aqWorks.res,
        JSON.stringify({ aqWorks, aqDrawn, aqPicks }));
      // The market, the forum and the warehouse drawn as models (render3d/models/commerce.js),
      // the warehouse's stock as loads in its court, and a click on each picks it by its footprint;
      // the prefecture and the engineer's post likewise (render3d/models/services.js).
      const commerce = [];
      for (const type of ['market', 'forum', 'warehouse', 'prefecture', 'engineer_post']) {
        const b = await gp.evaluate((t) => {
          const app = window.colonia;
          const w = [...app.game.buildings.values()].find((x) => x.type === t);
          if (!w) return null;
          if (t === 'warehouse') Object.assign(w.stock, { wine: 450, timber: 200 });
          app.renderer.camera.zoomIndex = 3;
          app.renderer.camera.centerOnTile(w.x + w.size / 2, w.y + w.size / 2);
          return { id: w.id, x: w.x, y: w.y, size: w.size };
        }, type);
        if (!b) {
          commerce.push({ type, missing: true });
          continue;
        }
        // Wait for the model (and the warehouse's loads) to be built, not a fixed time: kits
        // are built a few a frame within a time budget, and under CI's software GL a fixed
        // 400 ms found the wine loads not yet built (0 of 5) and once the forum not drawn.
        await gp.waitForFunction((t) => {
          const r = window.colonia.renderer;
          const mp = r.stats.modelPass || {};
          if (!((mp.byType || {})[t] >= 1)) return false;
          if (t !== 'warehouse') return true;
          const loads = r.backend.models.kits.get(`warehouse:load:wine|${mp.lod}`);
          return !!loads && Math.max(...loads.meshes.map((im) => im.count)) === 5;
        }, type, { timeout: 20000, polling: 100 }).catch(() => {});
        const drawn3d = await gp.evaluate(() => {
          const mp = window.colonia.renderer.stats.modelPass || {};
          const loads = window.colonia.renderer.backend.models.kits.get(`warehouse:load:wine|${mp.lod}`);
          return { byType: mp.byType || {}, wine: loads ? Math.max(...loads.meshes.map((im) => im.count)) : 0 };
        });
        const p = await onPage(b.x + b.size / 2, b.y + b.size / 2);
        await gp.mouse.click(p.x, p.y);
        await gp.waitForTimeout(150);
        const target = await gp.evaluate(() => window.colonia.ui.info.target);
        await gp.evaluate(() => window.colonia.ui.info.close());
        if (shots) await gp.screenshot({ path: path.join(shots, `smoke-webgl-${type}.png`) });
        commerce.push({ type, drawn: drawn3d.byType[type] || 0, wine: drawn3d.wine, picked: target?.kind === 'building' && target.id === b.id });
      }
      check("WebGL renderer: the market, the forum, the warehouse, the prefecture and the engineer's post are 3D models, the warehouse shows its loads, a click picks each",
        commerce.every((c) => !c.missing && c.drawn >= 1 && c.picked) && commerce.find((c) => c.type === 'warehouse').wine === 5,
        JSON.stringify(commerce));
      // The town wall (render3d/walls/, models/townWall.js): a wall dragged across a straight road
      // makes a gate between round flanking towers, a Turris placed beside its end; drawn as 3D
      // models, a click on the gate picks its tile and one on the Turris the building. Then cleared
      // again, so the steps after see the city as it was.
      const walls = await gp.evaluate(() => {
        const app = window.colonia;
        const g = app.game;
        const m = g.map;
        const free = (x, y) => m.inBounds(x, y) && m.isFree(x, y);
        let at = null;
        for (let i = 0; i < m.size && !at; i++) {
          const x = m.xOf(i);
          const y = m.yOf(i);
          if (!m.road[i] || m.wall[i] || m.building[i] || !m.hasRoad(x, y - 1) || !m.hasRoad(x, y + 1) || m.hasRoad(x - 1, y) || m.hasRoad(x + 1, y)) continue;
          if (free(x - 1, y) && free(x - 2, y) && free(x + 1, y) && free(x + 2, y) && free(x + 3, y) && free(x + 4, y) && free(x + 3, y - 1) && free(x + 4, y - 1)) at = { x, y };
        }
        if (!at) return null;
        at.free = g.cheats.freeBuild;
        g.cheats.freeBuild = true;
        app.ui.selectTool('wall');
        app.input.drag = { x0: at.x - 2, y0: at.y, x1: at.x + 2, y1: at.y };
        app.input.refreshPlan();
        app.applyPlan(app.renderer.plan);
        app.input.drag = null;
        // The Turris at the wall's east end, its footprint (x + 3..4, y - 1..y).
        app.ui.selectTool('tower');
        app.input.hover = { x: at.x + 3, y: at.y - 1 };
        app.input.refreshPlan();
        const plan = app.renderer.plan;
        if (plan && plan.items.every((it) => it.ok)) app.applyPlan(plan);
        app.ui.selectTool(null);
        // (Where the tool put it for that hover: next to the wall's end.)
        const t = [...g.buildings.values()].find((b) => b.type === 'tower' && Math.abs(b.x - at.x - 3) <= 1 && Math.abs(b.y - at.y + 1) <= 1);
        app.renderer.camera.zoomIndex = 4;
        app.renderer.camera.centerOnTile(at.x + 1, at.y);
        return { ...at, gate: m.wall[m.idx(at.x, at.y)], tower: t ? t.id : null, tx: t ? t.x : 0, ty: t ? t.y : 0 };
      });
      // Waiting for the state, not a time: kits are built within a frame's budget, slowly under a software GL.
      await gp.waitForFunction(() => {
        const by = window.colonia.renderer.stats.modelPass?.byType || {};
        return by.wall >= 5 && by.tower >= 1;
      }, null, { timeout: 30000, polling: 100 }).catch(() => {});
      const wallDrawn = await gp.evaluate(() => ({ ...(window.colonia.renderer.stats.modelPass?.byType || {}) }));
      const wallPicks = {};
      if (walls) {
        await gp.mouse.move(300, 12);
        let p = await onPage(walls.x + 0.5, walls.y + 0.5);
        await gp.mouse.click(p.x, p.y);
        await gp.waitForTimeout(150);
        wallPicks.gate = await gp.evaluate(() => window.colonia.ui.info.target);
        await gp.evaluate(() => window.colonia.ui.info.close());
        p = await onPage(walls.tx + 1, walls.ty + 1);
        await gp.mouse.click(p.x, p.y);
        await gp.waitForTimeout(150);
        wallPicks.tower = await gp.evaluate(() => window.colonia.ui.info.target);
        await gp.evaluate(() => window.colonia.ui.info.close());
        if (shots) await gp.screenshot({ path: path.join(shots, 'smoke-webgl-walls.png') });
        await gp.evaluate((at) => {
          const app = window.colonia;
          app.ui.selectTool('clear');
          // (The wall's row, whose gate leaves its road behind, and the Turris's footprint: never the road beside them.)
          for (const d of [{ x0: at.x - 2, y0: at.y, x1: at.x + 2, y1: at.y }, ...(at.tower ? [{ x0: at.tx, y0: at.ty, x1: at.tx + 1, y1: at.ty + 1 }] : [])]) {
            app.input.drag = d;
            app.input.refreshPlan();
            if (app.renderer.plan) app.applyPlan(app.renderer.plan);
          }
          app.input.drag = null;
          app.ui.selectTool(null);
          app.game.cheats.freeBuild = at.free;
        }, walls);
      }
      check('WebGL renderer: walls, a gate and a Turris are 3D models; a click on the gate picks its tile, on the Turris the building',
        !!walls && walls.gate === 2 && !!walls.tower && wallDrawn.wall >= 5 && wallDrawn.tower >= 1
          && wallPicks.gate?.kind === 'tile' && wallPicks.gate.x === walls.x && wallPicks.gate.y === walls.y
          && wallPicks.tower?.kind === 'building' && wallPicks.tower.id === walls.tower,
        JSON.stringify({ walls, wallDrawn, wallPicks }));
      // A walker in view, clicked on its body (painted into the frame's live-art texture).
      await gp.evaluate(() => { const app = window.colonia; app.renderer.camera.zoomIndex = 2; app.game.runDays(1); });
      await gp.waitForTimeout(300);
      let walker = await gp.evaluate(() => {
        const app = window.colonia;
        const r = app.renderer;
        const cam = r.camera;
        const rect = app.canvas.getBoundingClientRect();
        const g = app.game;
        const pick = () => {
          for (const s of r.walkerSpots) {
            const q = cam.toScreen(s.wx, s.wy - 9);
            const x = rect.left + q.x / cam.dpr;
            const y = rect.top + q.y / cam.dpr;
            if (x < rect.left + 360 || x > rect.right - 40 || y < rect.top + 80 || y > rect.bottom - 120) continue;
            // A click arrives at whole pixels, so the walker must be the one picked at
            // every whole pixel round the point: where two walkers overlap, a fraction of
            // a pixel picked the other one (CI, v0.20.3).
            const xi = Math.round(x);
            const yi = Math.round(y);
            let same = true;
            for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) if (r.pickWalker(xi + dx - rect.left, yi + dy - rect.top) !== s.id) same = false;
            if (!same) continue;
            return { id: s.id, x: xi, y: yi };
          }
          return null;
        };
        const found = pick();
        if (found) return found;
        const w = [...g.walkers.values()].find((v) => g.map.road[g.map.idx(v.x, v.y)] && v.kind === 'roamer');
        if (w) cam.centerOnTile(w.x, w.y);
        r.render(0, 0);
        return pick();
      });
      // The pick must still hold in the game's own frames: under CI's software GL the 3D models
      // nearby can finish loading after the test's frame, and a model ready changes what hides a
      // walker, so the walker picked there was covered by the click (v0.20.11 to v0.20.13).
      for (let k = 0; walker && k < 10; k++) {
        await gp.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));
        const still = await gp.evaluate((wk) => {
          const app = window.colonia;
          const rect = app.canvas.getBoundingClientRect();
          return app.renderer.pickWalker(wk.x - rect.left, wk.y - rect.top, false) === wk.id && app.renderer.stats.pending === 0;
        }, walker);
        if (still) break;
        walker = await gp.evaluate(() => {
          const app = window.colonia;
          const r = app.renderer;
          const cam = r.camera;
          const rect = app.canvas.getBoundingClientRect();
          for (const s of r.walkerSpots) {
            const q = cam.toScreen(s.wx, s.wy - 9);
            const x = Math.round(rect.left + q.x / cam.dpr);
            const y = Math.round(rect.top + q.y / cam.dpr);
            if (x < rect.left + 360 || x > rect.right - 40 || y < rect.top + 80 || y > rect.bottom - 120) continue;
            let same = true;
            for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) if (r.pickWalker(x + dx - rect.left, y + dy - rect.top, false) !== s.id) same = false;
            if (same) return { id: s.id, x, y };
          }
          return null;
        });
      }
      let wpick = null;
      if (walker) {
        await gp.mouse.click(walker.x, walker.y);
        // Waited for by state, a frame drawn with his ring: under the software GL a frame can take
        // longer than a fixed 150 ms (programs compiled once the models are ready stall it; the
        // land units' added theirs, and the frame read before the click's was drawn had no live art).
        await gp.waitForFunction((id) => {
          const app = window.colonia;
          return app.ui.info.target?.id === id && app.renderer.selectedWalker === id && app.renderer.stats.live > 0;
        }, walker.id, { timeout: 10000, polling: 50 }).catch(() => {});
        wpick = await gp.evaluate(() => ({ target: window.colonia.ui.info.target, ring: window.colonia.renderer.selectedWalker, live: window.colonia.renderer.stats.live }));
      }
      check('WebGL renderer: a click on a walker opens its panel', !!walker && wpick.target?.kind === 'walker' && wpick.target.id === walker.id && wpick.ring === walker.id && wpick.live > 0, JSON.stringify({ walker, wpick }));
      await gp.evaluate(() => window.colonia.ui.info.close());
      // Closer zooms under WebGL (config.js ZOOM_LEVELS_3D): the wheel goes on past Classic's 2x to
      // the closest level, and at 4x a click picks the well (a model, by its footprint) and a walker.
      await gp.evaluate((v) => { const cam = window.colonia.renderer.camera; cam.zoomIndex = 4; cam.centerOnTile(v.x, v.y); }, well);
      await gp.waitForTimeout(200);
      const wheelAt = await onPage(well.x + 0.5, well.y + 0.5);
      await gp.mouse.move(wheelAt.x, wheelAt.y);
      const wheelSeen = [];
      for (let k = 0; k < 4; k++) {
        await gp.mouse.wheel(0, -100);
        await gp.waitForTimeout(400);
        wheelSeen.push(await gp.evaluate(() => window.colonia.renderer.camera.targetZoom));
      }
      await gp.waitForTimeout(400);
      const closest = await gp.evaluate(() => { const c = window.colonia.renderer.camera; return { zoom: c.zoom, levels: c.levels, moving: c.moving, spriteScale: c.spriteScale }; });
      await gp.evaluate((v) => { const app = window.colonia; app.renderer.camera.zoomIndex = 6; app.renderer.camera.centerOnTile(v.x, v.y); app.ui.info.close(); }, well);
      await gp.waitForTimeout(300);
      const close4 = await onPage(well.x + 0.5, well.y + 0.5);
      await gp.mouse.click(close4.x, close4.y);
      await gp.waitForTimeout(150);
      const wellAt4 = await gp.evaluate(() => {
        const r = window.colonia.renderer;
        // (A model's own sprite, never drawn, only read for what hides a figure: from the small cover cache, not at 4x's scale.)
        const wellKeys = (m) => [...m.keys()].filter((k) => k.startsWith('b:well:')).length;
        return { zoom: r.camera.zoom, target: window.colonia.ui.info.target, models: r.stats.models, drawnSprites: wellKeys(r.sprites.current), cover: wellKeys(r.coverSprites.current) };
      });
      await gp.evaluate(() => window.colonia.ui.info.close());
      const walker4 = await gp.evaluate(() => {
        const app = window.colonia;
        const r = app.renderer;
        const cam = r.camera;
        const rect = app.canvas.getBoundingClientRect();
        const g = app.game;
        // A walker on a road in the middle of the view, picked the same at every whole pixel round the point.
        for (const w of [...g.walkers.values()].filter((v) => g.map.road[g.map.idx(v.x, v.y)] && v.kind !== 'ship').slice(0, 40)) {
          cam.centerOnTile(w.x, w.y);
          r.render(0, 0);
          const s = r.walkerSpots.find((q) => q.id === w.id);
          if (!s) continue;
          const q = cam.toScreen(s.wx, s.wy - 9);
          const x = Math.round(rect.left + q.x / cam.dpr);
          const y = Math.round(rect.top + q.y / cam.dpr);
          let same = true;
          for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) if (r.pickWalker(x + dx - rect.left, y + dy - rect.top) !== w.id) same = false;
          if (same) return { id: w.id, x, y };
        }
        return null;
      });
      let wpick4 = null;
      if (walker4) {
        await gp.mouse.click(walker4.x, walker4.y);
        await gp.waitForTimeout(150);
        wpick4 = await gp.evaluate(() => window.colonia.ui.info.target);
        await gp.evaluate(() => window.colonia.ui.info.close());
      }
      if (shots) await gp.screenshot({ path: path.join(shots, 'smoke-webgl-zoom4.png') });
      const top = closest.levels.at(-1);
      check('WebGL renderer: the wheel zooms in past 2x to its closest level, and at 4x a click picks the well (its sprite only in the small cover cache) and a walker',
        top >= 4 && wheelSeen.join() === closest.levels.slice(5).concat([top, top, top, top]).slice(0, 4).join() && closest.zoom === top && !closest.moving
          && wellAt4.zoom === 4 && wellAt4.models >= 1 && wellAt4.target?.kind === 'building' && wellAt4.target.id === well.id && wellAt4.drawnSprites === 0 && wellAt4.cover >= 1
          && !!walker4 && wpick4?.kind === 'walker' && wpick4.id === walker4.id,
        JSON.stringify({ wheelSeen, closest, wellAt4, walker4, wpick4 }));
      // The page's canvases: the WebGL one on the page under a transparent 2D overlay, #view on
      // top, see-through, still the one a click lands on (Renderer.mountLayers).
      const layers = await gp.evaluate(() => {
        const app = window.colonia;
        const r = app.renderer;
        const box = r.canvas.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        const gl = r.backend.canvas;
        return { hitView: hit === r.canvas, viewOpacity: r.canvas.style.opacity, glOnPage: !!gl.parentNode, glPointer: getComputedStyle(gl).pointerEvents, overPointer: getComputedStyle(r.over).pointerEvents, order: [...r.canvas.parentNode.children].indexOf(gl) < [...r.canvas.parentNode.children].indexOf(r.canvas), copy: r.stats.copyMs };
      });
      check('WebGL renderer: its canvas is on the page under the 2D overlay and #view, which still takes the clicks; nothing is copied', layers.hitView && layers.viewOpacity === '0' && layers.glOnPage && layers.glPointer === 'none' && layers.overPointer === 'none' && layers.order && layers.copy === null, JSON.stringify(layers));
      // The composed picture shows what is drawn over the 3D scene: the night's tint, and a red
      // no-road sign over a building with no road (the sign on the 2D overlay, the night in GL).
      const dayNight = await gp.evaluate(() => {
        const r = window.colonia.renderer;
        // The mean brightness of a sample of the composed picture.
        const mean = () => {
          const d = r.composedImage().data;
          let s = 0;
          let n = 0;
          for (let i = 0; i < d.length; i += 4 * 61) { s += d[i] + d[i + 1] + d[i + 2]; n += 3; }
          return s / n;
        };
        r.fixedTime = 0.3;
        const day = mean();
        r.fixedTime = 0.8;
        const night = mean();
        const lights = r.stats.lights;
        r.fixedTime = null;
        return { day: Math.round(day), night: Math.round(night), lights };
      });
      check('WebGL renderer: the night\'s tint darkens the composed 3D picture', dayNight.night < dayNight.day * 0.75, JSON.stringify(dayNight));
      const sign = await gp.evaluate(() => {
        const app = window.colonia;
        const g = app.game;
        const r = app.renderer;
        const before = new Set(g.buildings.keys());
        const w = [...g.buildings.values()].find((b) => b.type === 'well');
        app.ui.selectTool('prefecture');
        app.input.mouse.over = true;
        let placed = null;
        for (let rad = 4; rad < 40 && !placed; rad++) {
          for (let dy = -rad; dy <= rad && !placed; dy++) {
            for (let dx = -rad; dx <= rad && !placed; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
              app.input.hover = { x: w.x + dx, y: w.y + dy };
              app.input.refreshPlan();
              const plan = r.plan;
              if (!plan || plan.items.length !== 1 || !plan.items[0].ok || !plan.items[0].noRoad) continue;
              app.applyPlan(plan);
              placed = [...g.buildings.values()].find((x) => !before.has(x.id));
            }
          }
        }
        app.ui.selectTool(null);
        app.input.hover = null;
        r.hoverTile = null;
        if (!placed) return null;
        r.camera.centerOnTile(placed.x, placed.y);
        r.render(0, 0);
        const spot = r.noRoadSpots.find((s) => s.id === placed.id);
        if (!spot) return { placed: placed.id, spot: null };
        const n = Math.ceil(spot.r);
        const px = r.composedImage(Math.round(spot.x - n), Math.round(spot.y - n), 2 * n, 2 * n).data;
        let red = 0;
        for (let q = 0; q < px.length; q += 4) if (px[q] > 170 && px[q + 1] < 90 && px[q + 2] < 90) red++;
        return { placed: placed.id, spot: true, red, of: px.length / 4, overlay: r.over.style.visibility };
      });
      if (shots) await gp.screenshot({ path: path.join(shots, 'smoke-webgl-sign.png') });
      check('WebGL renderer: a no-road sign shows in the composed picture over the 3D scene', !!sign && sign.spot && sign.red > sign.of * 0.15 && sign.overlay !== 'hidden', JSON.stringify(sign));
      // The performance readout (F3, the console's perf): frames, stages, the GPU and the scene's size.
      await gp.mouse.move(640, 400);
      await gp.keyboard.press('F3');
      await gp.waitForTimeout(1300);
      const readout = await gp.evaluate(() => ({ shown: !document.getElementById('debug-hud').classList.contains('hidden'), text: document.getElementById('debug-hud').textContent, perf: window.colonia.ui.console.run('perf') }));
      await gp.keyboard.press('F3');
      check('the performance readout (F3, console perf) shows frames a second, the stages, the 3D scene\'s size and the GPU', readout.shown && /fps/.test(readout.text) && /collect/.test(readout.perf) && /3D scene \d+x\d+/.test(readout.perf) && /GPU: .*SwiftShader/i.test(readout.perf), JSON.stringify(readout).slice(0, 600));
      // Settings > Render scale: 50% draws the WebGL canvas at half the view's pixels (the page
      // stretches it; #view and the overlay stay full size), kept in the settings; back to Auto.
      await gp.keyboard.press('Escape');
      await gp.click('.modal .btn:has-text("Settings")');
      const scaleShown = await gp.evaluate(() => document.querySelector('select[aria-label="Render scale"]')?.value || null);
      await gp.selectOption('select[aria-label="Render scale"]', '0.5');
      await gp.waitForTimeout(400);
      const half = await gp.evaluate(() => {
        const r = window.colonia.renderer;
        const be = r.backend;
        return { scale: be.sceneScale, gl: [be.canvas.width, be.canvas.height], view: [r.camera.viewW, r.camera.viewH], over: [r.over.width, r.over.height], css: [be.canvas.style.width, r.canvas.style.width], stored: JSON.parse(localStorage.getItem('colonia.settings')).renderScale, auto: !!be.auto };
      });
      await gp.selectOption('select[aria-label="Render scale"]', 'auto');
      await gp.waitForTimeout(200);
      const backAuto = await gp.evaluate(() => !!window.colonia.renderer.backend.auto);
      await gp.click('.modal .btn:has-text("Done")');
      check('Settings > Render scale: 50% draws the 3D scene at half the pixels, the overlay and the page box as before; Auto again',
        scaleShown === 'auto' && half.scale === 0.5 && half.gl[0] === Math.round(half.view[0] / 2) && half.gl[1] === Math.round(half.view[1] / 2) && half.over[0] === half.view[0] && half.css[0] === half.css[1] && half.stored === '0.5' && !half.auto && backAuto,
        JSON.stringify({ scaleShown, half, backAuto }));
      // A lost WebGL context: the Classic renderer draws meanwhile; restored, WebGL again.
      const lose = await gp.evaluate(() => {
        const ext = window.colonia.renderer.backend.gl.getContext().getExtension('WEBGL_lose_context');
        if (!ext) return false;
        window.__loseExt = ext;
        ext.loseContext();
        return true;
      });
      await gp.waitForTimeout(400);
      const during = await gp.evaluate(() => ({ backend: window.colonia.renderer.stats.backend, objects: window.colonia.renderer.stats.objects, viewOpacity: window.colonia.renderer.canvas.style.opacity, glHidden: window.colonia.renderer.backend.canvas.style.visibility }));
      if (lose) await gp.evaluate(() => window.__loseExt.restoreContext());
      await gp.waitForTimeout(600);
      const after = await gp.evaluate(() => ({ backend: window.colonia.renderer.stats.backend, models: window.colonia.renderer.stats.models, drawCalls: window.colonia.renderer.stats.drawCalls }));
      check('WebGL renderer: a lost context hands the drawing to Classic (on #view, shown again), and WebGL takes it back when restored', lose && during.backend === '2d' && during.objects > 50 && during.viewOpacity === '' && during.glHidden === 'hidden' && after.backend === 'webgl' && after.drawCalls > 0, JSON.stringify({ lose, during, after }));
      // Settings > Renderer: back to Classic, the setting kept.
      await gp.mouse.move(640, 400);
      await gp.keyboard.press('Escape'); // the game menu
      await gp.click('.modal .btn:has-text("Settings")');
      const shown = await gp.evaluate(() => document.querySelector('select[aria-label="Renderer"]')?.value || null);
      // (At 4x, closer than Classic goes: Classic takes its closest, 2x.)
      await gp.evaluate(() => { window.colonia.renderer.camera.zoomIndex = 6; });
      await gp.selectOption('select[aria-label="Renderer"]', 'classic');
      await gp.waitForTimeout(300);
      const switched = await gp.evaluate(() => ({ backend: window.colonia.renderer.stats.backend, kind: window.colonia.renderer.backend.kind, setting: window.colonia.settings.renderer, stored: JSON.parse(localStorage.getItem('colonia.settings')).renderer, zoom: window.colonia.renderer.camera.zoom, levels: window.colonia.renderer.camera.levels.length }));
      await gp.click('.modal .btn:has-text("Done")');
      // The wheel in Classic stops at 2x.
      await gp.mouse.move(640, 400);
      await gp.mouse.wheel(0, -100);
      await gp.waitForTimeout(500);
      const classicZoom = await gp.evaluate(() => window.colonia.renderer.camera.targetZoom);
      check("WebGL renderer: Settings shows it, and switches back to Classic (kept in the settings), from 4x to Classic's closest, 2x, where the wheel stops", shown === 'webgl' && switched.backend === '2d' && switched.kind === '2d' && switched.setting === 'classic' && switched.stored === 'classic' && switched.zoom === 2 && switched.levels === 5 && classicZoom === 2, JSON.stringify({ shown, switched, classicZoom }));
      check('WebGL renderer: no page errors', gerrors.length === 0, gerrors.join(' | '));
      await gp.close();

      // 8a. The fleet's waterside buildings on a coast (render3d/models/fleet.js):
      //     the Navalia, the Statio and the Portus drawn as 3D models out over
      //     the water, a click on each picks it by its footprint, and the
      //     navalia's hull on its slip follows the sim's progress.
      {
        const fp = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const ferrors = [];
        fp.on('pageerror', (e) => ferrors.push(`pageerror: ${e.message}`));
        fp.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) ferrors.push(m.text()); });
        await fp.goto(`${url}?skipmenu=1&maptype=coast&map=small&seed=demo&mute=1&money=90000&renderer=3d`);
        await fp.waitForFunction(() => window.colonia && window.colonia.game, null, { timeout: 30000 });
        const built = await fp.evaluate(() => {
          const app = window.colonia;
          app.paused = true;
          app.ui.console.run('demo 2');
          app.ui.console.run('navy');
          app.ui.console.run('academy');
          return [...app.game.buildings.values()].filter((b) => ['navalia', 'naval_station', 'portus'].includes(b.type)).map((b) => b.type).sort();
        });
        const fleet3d = [];
        for (const type of ['navalia', 'naval_station', 'portus']) {
          const b = await fp.evaluate((t) => {
            const app = window.colonia;
            const v = [...app.game.buildings.values()].find((x) => x.type === t);
            if (!v) return null;
            if (t === 'navalia') v.progress = 60; // (a ship planked to the sheer on the slip: hullStep 3)
            app.ui.info.close();
            app.renderer.camera.zoomIndex = 3;
            app.renderer.camera.centerOnTile(v.x + v.size / 2, v.y + v.size / 2);
            return { id: v.id, x: v.x, y: v.y, size: v.size, side: v.waterSide, rows: v.waterRows };
          }, type);
          if (!b) {
            fleet3d.push({ type, missing: true });
            continue;
          }
          // Wait for the model and its kits, not a fixed time: under a software GL kits are built a few a frame.
          await fp.waitForFunction((t) => {
            const r = window.colonia.renderer;
            const mp = r.stats.modelPass || {};
            if (!((mp.byType || {})[t] >= 1) || mp.deferred) return false;
            if (t !== 'navalia') return true;
            const hull = r.backend.models.kits.get(`navalia:hull:3|${mp.lod}`);
            return !!hull && Math.max(...hull.meshes.map((im) => im.count)) >= 1;
          }, type, { timeout: 20000, polling: 100 }).catch(() => {});
          const drawn = await fp.evaluate((t) => {
            const r = window.colonia.renderer;
            const mp = r.stats.modelPass || {};
            const hull = r.backend.models.kits.get(`navalia:hull:3|${mp.lod}`);
            return { n: (mp.byType || {})[t] || 0, hull: hull ? Math.max(...hull.meshes.map((im) => im.count)) : 0 };
          }, type);
          const p = await fp.evaluate(([x, y]) => {
            const cam = window.colonia.renderer.camera;
            const w = cam.mapToWorld(x, y);
            const rc = window.colonia.canvas.getBoundingClientRect();
            return { x: rc.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: rc.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
          }, [b.x + b.size / 2, b.y + b.size / 2]);
          await fp.mouse.click(p.x, p.y);
          await fp.waitForFunction((id) => window.colonia.ui.info.target?.id === id, b.id, { timeout: 5000, polling: 50 }).catch(() => {});
          const target = await fp.evaluate(() => window.colonia.ui.info.target);
          await fp.evaluate(() => window.colonia.ui.info.close());
          if (shots) await fp.screenshot({ path: path.join(shots, `smoke-webgl-${type}.png`) });
          fleet3d.push({ type, ...b, drawn: drawn.n, hull: drawn.hull, picked: target?.kind === 'building' && target.id === b.id });
        }
        check("WebGL renderer: the Navalia, the Statio and the Portus are 3D models out over the water, the navalia's hull by its progress, a click picks each",
          built.length === 3 && fleet3d.every((c) => !c.missing && c.drawn >= 1 && c.picked && c.rows === 2) && fleet3d.find((c) => c.type === 'navalia').hull >= 1,
          JSON.stringify({ built, fleet3d }));
        check('WebGL renderer: no page errors on the coast with the fleet', ferrors.length === 0, ferrors.join(' | '));
        await fp.close();
      }

      // 8a. The ships in 3D (render3d/ships/): a raid by sea on a coast, its ships drawn as models
      //     with their crews, not as sprites (waited for: the crews' programs compile in the
      //     background, kits are built a few a frame under a software GL), and a click on a hull
      //     picks its ship.
      {
        const sp = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const serrs = [];
        sp.on('pageerror', (e) => serrs.push(`pageerror: ${e.message}`));
        sp.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) serrs.push(m.text()); });
        await sp.goto(`${url}?skipmenu=1&maptype=coast&map=small&seed=demo&mute=1&money=90000&renderer=3d&scale=1`);
        await sp.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
        const raid = await sp.evaluate(() => {
          const app = window.colonia;
          app.ui.console.run('demo 2');
          const said = app.ui.console.run('searaid 10');
          app.game.runDays(2);
          app.paused = true;
          const u = [...app.game.units.values()].find((v) => v.type === 'raider_ship');
          if (u) {
            app.renderer.camera.zoomIndex = 4;
            app.renderer.camera.centerOnTile(Math.floor(u.x), Math.floor(u.y));
          }
          return { said, id: u ? u.id : 0 };
        });
        // Drawn in 3D: the ships' pass on, the ship among them, no piece or kit left to build.
        const in3d = raid.id ? await sp.waitForFunction(() => {
          const r = window.colonia.renderer;
          const s = r.stats.ships3d;
          return !!s && s.ships >= 1 && !s.deferred && !(r.stats.modelPass || {}).deferred && r.stats.modelPass.kits > 0;
        }, null, { timeout: 60000, polling: 100 }).then(() => true, () => false) : false;
        const ship = await sp.evaluate((id) => {
          const r = window.colonia.renderer;
          const s = r.shipSpots.find((o) => o.id === id);
          const kits = [...r.backend.models.kits.keys()].filter((k) => k.startsWith('vessel:'));
          const hull = kits.map((k) => r.backend.models.kits.get(k)).find((k) => k.key.endsWith(':hull'));
          return { stats: r.stats.ships3d, spot: s ? { reach: Math.hypot(s.reachX || 0, s.reachY || 0) } : null, kits: kits.length, hulls: hull ? Math.max(...hull.meshes.map((im) => im.count)) : 0, sprite: r.stats.live };
        }, raid.id);
        // A click on the middle of its hull (its spot runs from the stern to the bow) opens its panel.
        const at = await sp.evaluate((id) => {
          const app = window.colonia;
          const r = app.renderer;
          const s = r.shipSpots.find((o) => o.id === id);
          if (!s) return null;
          const cam = r.camera;
          const rect = app.canvas.getBoundingClientRect();
          const wx = s.wx + (s.reachX || 0) / 2;
          const wy = s.wy + (s.reachY || 0) / 2 - 8;
          return { x: rect.left + ((wx - cam.x) * cam.scale) / cam.dpr, y: rect.top + ((wy - cam.y) * cam.scale) / cam.dpr };
        }, raid.id);
        if (at) await sp.mouse.click(at.x, at.y);
        await sp.waitForFunction((id) => window.colonia.ui.info.target?.id === id, raid.id, { timeout: 5000, polling: 50 }).catch(() => {});
        const picked = await sp.evaluate(() => ({ kind: window.colonia.ui.info.target?.kind, id: window.colonia.ui.info.target?.id }));
        if (shots) await sp.screenshot({ path: path.join(shots, 'smoke-webgl-ships.png') });
        check('WebGL renderer: the ships are 3D models with crews (a raid by sea), and a click on a hull picks its ship',
          !!raid.id && in3d && ship.stats && ship.stats.ships >= 1 && ship.stats.people >= 1 && ship.hulls >= 1 && ship.spot && ship.spot.reach > 20
            && picked.kind === 'unit' && picked.id === raid.id,
          JSON.stringify({ raid, in3d, ship, picked }));
        check('WebGL renderer, 3D ships: no page errors', serrs.length === 0, serrs.join(' | '));
        await sp.close();
      }

      // 8a. The forts, the barracks and the military academy as models (render3d/models/
      //     militaryModels.js): the console's garrison and academy build them; each draws as
      //     a model (waited for: kits are built within a frame's budget, slowly under a
      //     software GL) and a click on its footprint picks it; a soldier at rest in his
      //     fort's yard is drawn over the model and a click on him opens his panel.
      {
        const gm = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const merrs = [];
        gm.on('pageerror', (e) => merrs.push(`pageerror: ${e.message}`));
        gm.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) merrs.push(m.text()); });
        await gm.goto(`${url}?skipmenu=1&map=small&seed=webgl3&mute=1&renderer=3d`);
        await gm.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
        const TYPES = ['fort_legion', 'fort_archer', 'fort_cavalry', 'barracks', 'military_academy'];
        const mil = await gm.evaluate((types) => {
          const app = window.colonia;
          app.ui.console.run('demo 2');
          app.ui.console.run('garrison');
          app.ui.console.run('days 60');
          app.ui.console.run('academy');
          app.paused = true;
          app.renderer.fixedTime = 0.3;
          const out = {};
          for (const t of types) {
            const b = [...app.game.buildings.values()].find((v) => v.type === t);
            out[t] = b ? { id: b.id, x: b.x, y: b.y, size: b.size } : null;
          }
          return out;
        }, TYPES);
        const onPageM = (fx, fy) => gm.evaluate(([x, y]) => {
          const app = window.colonia;
          const cam = app.renderer.camera;
          const w = cam.mapToWorld(x, y);
          const r = app.canvas.getBoundingClientRect();
          return { x: r.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: r.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
        }, [fx, fy]);
        const military = [];
        for (const type of TYPES) {
          const b = mil[type];
          if (!b) {
            military.push({ type, missing: true });
            continue;
          }
          await gm.evaluate((v) => { const app = window.colonia; app.ui.info.close(); app.renderer.camera.zoomIndex = 4; app.renderer.camera.centerOnTile(v.x + v.size / 2, v.y + v.size / 2); }, b);
          await gm.waitForFunction((t) => {
            const r = window.colonia.renderer;
            return ((r.stats.modelPass?.byType || {})[t] || 0) >= 1 && !r.stats.pending;
          }, type, { timeout: 30000, polling: 100 }).catch(() => {});
          const drawn = await gm.evaluate((t) => (window.colonia.renderer.stats.modelPass?.byType || {})[t] || 0, type);
          // The footprint's front tile (the view's nearest corner): no man at rest stands there, and
          // a figure's sprite reaches up the screen from his feet, away from it.
          const p = await onPageM(b.x + b.size - 0.5, b.y + b.size - 0.5);
          await gm.mouse.click(p.x, p.y);
          await gm.waitForTimeout(150);
          const target = await gm.evaluate(() => window.colonia.ui.info.target);
          military.push({ type, drawn, picked: target?.kind === 'building' && target.id === b.id, target });
        }
        await gm.evaluate(() => window.colonia.ui.info.close());
        if (shots) await gm.screenshot({ path: path.join(shots, 'smoke-webgl-military.png') });
        check('WebGL renderer: the forts, the barracks and the military academy are 3D models, and a click picks each',
          military.every((m) => !m.missing && m.drawn >= 1 && m.picked), JSON.stringify(military));
        // A man at rest in his fort's yard, over the fort's model: a click on him opens his panel.
        const man = await gm.evaluate(() => {
          const app = window.colonia;
          const g = app.game;
          const inside = (u) => { const f = g.buildings.get(u.fort); return !!f && u.x >= f.x && u.y >= f.y && u.x < f.x + f.size && u.y < f.y + f.size; };
          const u = [...g.units.values()].find((v) => v.side === 'rome' && v.fort && v.state === 'idle' && inside(v));
          if (!u) return null;
          const f = g.buildings.get(u.fort);
          app.renderer.camera.zoomIndex = 4;
          app.renderer.camera.centerOnTile(f.x + f.size / 2, f.y + f.size / 2);
          return { id: u.id, fort: f.id, type: f.type };
        });
        let manPick = null;
        if (man) {
          await gm.waitForFunction((t) => ((window.colonia.renderer.stats.modelPass?.byType || {})[t] || 0) >= 1 && !window.colonia.renderer.stats.pending, man.type, { timeout: 30000, polling: 100 }).catch(() => {});
          const spot = await gm.evaluate((fortId) => {
            const app = window.colonia;
            const r = app.renderer;
            const cam = r.camera;
            const rect = app.canvas.getBoundingClientRect();
            for (const s of r.unitSpots) {
              const u = app.game.units.get(s.id);
              if (!u || u.fort !== fortId) continue;
              const q = cam.toScreen(s.wx, s.wy - 8);
              if (r.pickUnit(q.x / cam.dpr, q.y / cam.dpr) === s.id) return { id: s.id, x: rect.left + q.x / cam.dpr, y: rect.top + q.y / cam.dpr };
            }
            return null;
          }, man.fort);
          if (spot) {
            await gm.mouse.click(spot.x, spot.y);
            await gm.waitForTimeout(150);
            manPick = { id: spot.id, target: await gm.evaluate(() => window.colonia.ui.info.target) };
          }
        }
        check('WebGL renderer: a soldier at rest in his fort\'s yard shows over the fort\'s model, and a click on him opens his panel',
          !!manPick && manPick.target?.kind === 'unit' && manPick.target.id === manPick.id, JSON.stringify({ man, manPick }));
        check('WebGL renderer, military models: no page errors', merrs.length === 0, merrs.join(' | '));
        await gm.close();
      }

      // 8a2. The school, the library and the academy as models (render3d/models/education.js):
      //      the demo city's school and the console's `learning` library and academy; each draws
      //      as a model (waited for: under a software GL kits are built a few a frame) and a
      //      click on its footprint opens its panel.
      {
        const ge = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const eerrs = [];
        ge.on('pageerror', (e) => eerrs.push(`pageerror: ${e.message}`));
        ge.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) eerrs.push(m.text()); });
        await ge.goto(`${url}?skipmenu=1&map=small&seed=webgl3&mute=1&renderer=3d&scale=1`);
        await ge.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
        const EDU = ['school', 'library', 'academy'];
        const edu = await ge.evaluate((types) => {
          const app = window.colonia;
          app.ui.console.run('demo 2');
          const said = app.ui.console.run('learning');
          app.paused = true;
          app.renderer.fixedTime = 0.3;
          const out = { said };
          for (const t of types) {
            const b = [...app.game.buildings.values()].find((v) => v.type === t);
            out[t] = b ? { id: b.id, x: b.x, y: b.y, size: b.size } : null;
          }
          return out;
        }, EDU);
        const learning = [];
        for (const type of EDU) {
          const b = edu[type];
          if (!b) {
            learning.push({ type, missing: true });
            continue;
          }
          await ge.evaluate((v) => { const app = window.colonia; app.ui.info.close(); app.renderer.camera.zoomIndex = 4; app.renderer.camera.centerOnTile(v.x + v.size / 2, v.y + v.size / 2); }, b);
          await ge.waitForFunction((t) => {
            const r = window.colonia.renderer;
            const mp = r.stats.modelPass || {};
            return ((mp.byType || {})[t] || 0) >= 1 && !mp.deferred && !r.stats.pending;
          }, type, { timeout: 30000, polling: 100 }).catch(() => {});
          const drawn = await ge.evaluate((t) => (window.colonia.renderer.stats.modelPass?.byType || {})[t] || 0, type);
          const p = await ge.evaluate(([x, y]) => {
            const app = window.colonia;
            const cam = app.renderer.camera;
            const w = cam.mapToWorld(x, y);
            const r = app.canvas.getBoundingClientRect();
            return { x: r.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: r.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
          }, [b.x + b.size / 2, b.y + b.size / 2]);
          await ge.mouse.click(p.x, p.y);
          await ge.waitForFunction((id) => window.colonia.ui.info.target?.id === id, b.id, { timeout: 5000, polling: 50 }).catch(() => {});
          const target = await ge.evaluate(() => window.colonia.ui.info.target);
          learning.push({ type, drawn, picked: target?.kind === 'building' && target.id === b.id, target });
        }
        await ge.evaluate(() => window.colonia.ui.info.close());
        if (shots) await ge.screenshot({ path: path.join(shots, 'smoke-webgl-learning.png') });
        check('WebGL renderer: the school, the library and the academy are 3D models, and a click picks each',
          learning.every((m) => !m.missing && m.drawn >= 1 && m.picked), JSON.stringify({ said: edu.said, learning }));
        check('WebGL renderer, education models: no page errors', eerrs.length === 0, eerrs.join(' | '));
        await ge.close();
      }

      // 8a3. The barber, the physician, the baths and the hospital as models (render3d/models/
      //      health.js): the demo city's barber and physician and the console's `healing` baths
      //      and hospital; each draws as a model (waited for: under a software GL kits are built a
      //      few a frame) and a click on its footprint opens its panel.
      {
        const gh = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const herrs = [];
        gh.on('pageerror', (e) => herrs.push(`pageerror: ${e.message}`));
        gh.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) herrs.push(m.text()); });
        await gh.goto(`${url}?skipmenu=1&map=small&seed=webgl3&mute=1&renderer=3d&scale=1`);
        await gh.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
        const CARE = ['barber', 'clinic', 'baths', 'hospital'];
        const care = await gh.evaluate((types) => {
          const app = window.colonia;
          app.ui.console.run('demo 2');
          const said = app.ui.console.run('healing');
          app.paused = true;
          app.renderer.fixedTime = 0.3;
          const out = { said };
          for (const t of types) {
            const b = [...app.game.buildings.values()].find((v) => v.type === t);
            out[t] = b ? { id: b.id, x: b.x, y: b.y, size: b.size } : null;
          }
          return out;
        }, CARE);
        const healing = [];
        for (const type of CARE) {
          const b = care[type];
          if (!b) {
            healing.push({ type, missing: true });
            continue;
          }
          await gh.evaluate((v) => { const app = window.colonia; app.ui.info.close(); app.renderer.camera.zoomIndex = 4; app.renderer.camera.centerOnTile(v.x + v.size / 2, v.y + v.size / 2); }, b);
          await gh.waitForFunction((t) => {
            const r = window.colonia.renderer;
            const mp = r.stats.modelPass || {};
            return ((mp.byType || {})[t] || 0) >= 1 && !mp.deferred && !r.stats.pending;
          }, type, { timeout: 30000, polling: 100 }).catch(() => {});
          const drawn = await gh.evaluate((t) => (window.colonia.renderer.stats.modelPass?.byType || {})[t] || 0, type);
          const p = await gh.evaluate(([x, y]) => {
            const app = window.colonia;
            const cam = app.renderer.camera;
            const w = cam.mapToWorld(x, y);
            const r = app.canvas.getBoundingClientRect();
            return { x: r.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: r.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
          }, [b.x + b.size / 2, b.y + b.size / 2]);
          await gh.mouse.click(p.x, p.y);
          await gh.waitForFunction((id) => window.colonia.ui.info.target?.id === id, b.id, { timeout: 5000, polling: 50 }).catch(() => {});
          const target = await gh.evaluate(() => window.colonia.ui.info.target);
          healing.push({ type, drawn, picked: target?.kind === 'building' && target.id === b.id, target });
        }
        await gh.evaluate(() => window.colonia.ui.info.close());
        if (shots) await gh.screenshot({ path: path.join(shots, 'smoke-webgl-healing.png') });
        check('WebGL renderer: the barber, the physician, the baths and the hospital are 3D models, and a click picks each',
          healing.every((m) => !m.missing && m.drawn >= 1 && m.picked), JSON.stringify({ said: care.said, healing }));
        check('WebGL renderer, health models: no page errors', herrs.length === 0, herrs.join(' | '));
        await gh.close();
      }

      // 8a3b. The training buildings of the shows as models (render3d/models/training.js): the console's
      //       `training` puts an actor troupe, a gladiator school, a menagerie and a chariot stable by
      //       the demo city; each draws as a model (waited for), its people and beasts with it, and a
      //       click on its footprint opens its panel.
      {
        const gt = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const terrs = [];
        gt.on('pageerror', (e) => terrs.push(`pageerror: ${e.message}`));
        gt.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) terrs.push(m.text()); });
        await gt.goto(`${url}?skipmenu=1&map=small&seed=webgl3&mute=1&renderer=3d&scale=1`);
        await gt.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
        const SHOWS = ['actor_troupe', 'gladiator_school', 'menagerie', 'chariot_maker'];
        const placed = await gt.evaluate((types) => {
          const app = window.colonia;
          app.ui.console.run('demo 2');
          const said = app.ui.console.run('training');
          app.paused = true;
          app.renderer.fixedTime = 0.3;
          const out = { said };
          for (const t of types) {
            const b = [...app.game.buildings.values()].find((v) => v.type === t);
            out[t] = b ? { id: b.id, x: b.x, y: b.y, size: b.size } : null;
          }
          return out;
        }, SHOWS);
        const trained = [];
        for (const type of SHOWS) {
          const b = placed[type];
          if (!b) {
            trained.push({ type, missing: true });
            continue;
          }
          await gt.evaluate((v) => { const app = window.colonia; app.ui.info.close(); app.renderer.camera.zoomIndex = 4; app.renderer.camera.centerOnTile(v.x + v.size / 2, v.y + v.size / 2); }, b);
          await gt.waitForFunction((t) => {
            const r = window.colonia.renderer;
            const mp = r.stats.modelPass || {};
            return ((mp.byType || {})[t] || 0) >= 1 && !mp.deferred && !r.stats.pending;
          }, type, { timeout: 30000, polling: 100 }).catch(() => {});
          const drawn = await gt.evaluate((t) => { const mp = window.colonia.renderer.stats.modelPass || {}; return { n: (mp.byType || {})[t] || 0, people: mp.people || 0 }; }, type);
          const p = await gt.evaluate(([x, y]) => {
            const app = window.colonia;
            const cam = app.renderer.camera;
            const w = cam.mapToWorld(x, y);
            const r = app.canvas.getBoundingClientRect();
            return { x: r.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: r.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
          }, [b.x + b.size / 2, b.y + b.size / 2]);
          await gt.mouse.click(p.x, p.y);
          await gt.waitForFunction((id) => window.colonia.ui.info.target?.id === id, b.id, { timeout: 5000, polling: 50 }).catch(() => {});
          const target = await gt.evaluate(() => window.colonia.ui.info.target);
          trained.push({ type, drawn: drawn.n, people: drawn.people, picked: target?.kind === 'building' && target.id === b.id, target });
        }
        await gt.evaluate(() => window.colonia.ui.info.close());
        if (shots) await gt.screenshot({ path: path.join(shots, 'smoke-webgl-training.png') });
        // (The menagerie's beasts and the stable's horses are actors: people > 0 even with the staff away.)
        check('WebGL renderer: the actor troupe, the gladiator school, the menagerie and the chariot stable are 3D models with their people and beasts, and a click picks each',
          trained.every((m) => !m.missing && m.drawn >= 1 && m.people >= 1 && m.picked), JSON.stringify({ said: placed.said, trained }));
        check('WebGL renderer, training models: no page errors', terrs.length === 0, terrs.join(' | '));
        await gt.close();
      }

      // 8a4. Gardens, statues, the gardeners' yard and the triumphal arch as models (render3d/
      //      models/decor.js): the console's `gardens` lays them out beside the demo city; each
      //      draws as a model (waited for: under a software GL kits are built a few a frame) and
      //      a click on its footprint opens its panel (the arch's on a pier, off its road).
      {
        const gd = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const derrs = [];
        gd.on('pageerror', (e) => derrs.push(`pageerror: ${e.message}`));
        gd.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) derrs.push(m.text()); });
        await gd.goto(`${url}?skipmenu=1&map=small&seed=webgl3&mute=1&renderer=3d&scale=1`);
        await gd.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
        const DECOR = ['garden', 'statue_small', 'statue_medium', 'statue_large', 'gardener_yard', 'triumphal_arch'];
        const laid = await gd.evaluate((types) => {
          const app = window.colonia;
          app.ui.console.run('demo 2');
          const said = app.ui.console.run('gardens 8');
          app.paused = true;
          app.renderer.fixedTime = 0.3;
          const out = { said };
          for (const t of types) {
            const b = [...app.game.buildings.values()].find((v) => v.type === t);
            out[t] = b ? { id: b.id, x: b.x, y: b.y, size: b.size, axis: b.axis } : null;
          }
          return out;
        }, DECOR);
        const decor = [];
        for (const type of DECOR) {
          const b = laid[type];
          if (!b) {
            decor.push({ type, missing: true });
            continue;
          }
          await gd.evaluate((v) => { const app = window.colonia; app.ui.info.close(); app.renderer.camera.zoomIndex = 4; app.renderer.camera.centerOnTile(v.x + v.size / 2, v.y + v.size / 2); }, b);
          await gd.waitForFunction((t) => {
            const r = window.colonia.renderer;
            const mp = r.stats.modelPass || {};
            return ((mp.byType || {})[t] || 0) >= 1 && !mp.deferred && !r.stats.pending;
          }, type, { timeout: 30000, polling: 100 }).catch(() => {});
          const drawn = await gd.evaluate((t) => (window.colonia.renderer.stats.modelPass?.byType || {})[t] || 0, type);
          // (The arch: a pier's tile, beside its road; the rest: the footprint's middle.)
          const at = type === 'triumphal_arch' ? (b.axis === 1 ? [b.x + 0.5, b.y + 1.5] : [b.x + 1.5, b.y + 0.5]) : [b.x + b.size / 2, b.y + b.size / 2];
          const p = await gd.evaluate(([x, y]) => {
            const app = window.colonia;
            const cam = app.renderer.camera;
            const w = cam.mapToWorld(x, y);
            const r = app.canvas.getBoundingClientRect();
            return { x: r.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: r.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
          }, at);
          await gd.mouse.click(p.x, p.y);
          await gd.waitForFunction((id) => window.colonia.ui.info.target?.id === id, b.id, { timeout: 5000, polling: 50 }).catch(() => {});
          const target = await gd.evaluate(() => window.colonia.ui.info.target);
          decor.push({ type, drawn, picked: target?.kind === 'building' && target.id === b.id, target });
        }
        await gd.evaluate(() => window.colonia.ui.info.close());
        if (shots) await gd.screenshot({ path: path.join(shots, 'smoke-webgl-gardens.png') });
        check('WebGL renderer: gardens, the three statues, the gardeners\' yard and the triumphal arch are 3D models, and a click picks each',
          decor.every((m) => !m.missing && m.drawn >= 1 && m.picked), JSON.stringify({ said: laid.said, decor }));
        check('WebGL renderer, decor models: no page errors', derrs.length === 0, derrs.join(' | '));
        await gd.close();
      }

      // 8a5. The senate house and the governor's three residences as models
      //       (render3d/models/government.js): the console's `government`, a grade at a time
      //       (only one residence may stand); each draws as a model (waited for: under a
      //       software GL kits are built a few a frame), its columns as kits of their own, and
      //       a click on its footprint opens its panel.
      {
        const gg = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const gerrs = [];
        gg.on('pageerror', (e) => gerrs.push(`pageerror: ${e.message}`));
        gg.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) gerrs.push(m.text()); });
        await gg.goto(`${url}?skipmenu=1&map=small&seed=webgl3&mute=1&renderer=3d&scale=1`);
        await gg.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
        await gg.evaluate(() => { window.colonia.ui.console.run('demo 2'); });
        const govern = [];
        for (const grade of ['palace', 'villa', 'house']) {
          const built = await gg.evaluate((g) => {
            const app = window.colonia;
            const said = app.ui.console.run(`government ${g}`);
            app.paused = true;
            app.renderer.fixedTime = 0.3;
            const pick = (b) => (b ? { id: b.id, type: b.type, x: b.x, y: b.y, size: b.size } : null);
            const all = [...app.game.buildings.values()];
            return { said, senate: pick(all.find((b) => b.type === 'senate')), residence: pick(all.find((b) => b.def.kind === 'residence')) };
          }, grade);
          // (The senate once, with the first grade: it stands through the others.)
          for (const b of grade === 'palace' ? [built.senate, built.residence] : [built.residence]) {
            if (!b) {
              govern.push({ grade, missing: true, said: built.said });
              continue;
            }
            await gg.evaluate((v) => { const app = window.colonia; app.ui.info.close(); app.renderer.camera.zoomIndex = 4; app.renderer.camera.centerOnTile(v.x + v.size / 2, v.y + v.size / 2); }, b);
            await gg.waitForFunction((t) => {
              const r = window.colonia.renderer;
              const mp = r.stats.modelPass || {};
              return ((mp.byType || {})[t] || 0) >= 1 && !mp.deferred && !r.stats.pending;
            }, b.type, { timeout: 30000, polling: 100 }).catch(() => {});
            const drawn = await gg.evaluate((t) => (window.colonia.renderer.stats.modelPass?.byType || {})[t] || 0, b.type);
            const p = await gg.evaluate(([x, y]) => {
              const app = window.colonia;
              const cam = app.renderer.camera;
              const w = cam.mapToWorld(x, y);
              const r = app.canvas.getBoundingClientRect();
              return { x: r.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: r.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
            }, [b.x + b.size / 2, b.y + b.size / 2]);
            await gg.mouse.click(p.x, p.y);
            await gg.waitForFunction((id) => window.colonia.ui.info.target?.id === id, b.id, { timeout: 5000, polling: 50 }).catch(() => {});
            const target = await gg.evaluate(() => window.colonia.ui.info.target);
            govern.push({ type: b.type, drawn, picked: target?.kind === 'building' && target.id === b.id, target });
          }
        }
        await gg.evaluate(() => window.colonia.ui.info.close());
        if (shots) await gg.screenshot({ path: path.join(shots, 'smoke-webgl-government.png') });
        check('WebGL renderer: the senate house and the governor\'s house, villa and palace are 3D models, and a click picks each',
          govern.length === 4 && govern.every((m) => !m.missing && m.drawn >= 1 && m.picked), JSON.stringify(govern));
        check('WebGL renderer, government models: no page errors', gerrs.length === 0, gerrs.join(' | '));
        await gg.close();
      }

      // 8a6. The temples, the oracle and the mission post as models (render3d/models/religion.js):
      //      the console's `temples` in a sandbox with native villages (the mission post is
      //      built only there); each draws as a model (waited for: under a software GL kits
      //      are built a few a frame) and a click on its footprint opens its panel (the shared
      //      kits are tests/religion3d.test.mjs's).
      {
        const gt = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const terrs = [];
        gt.on('pageerror', (e) => terrs.push(`pageerror: ${e.message}`));
        gt.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) terrs.push(m.text()); });
        await gt.goto(`${url}?skipmenu=1&natives=1&map=small&seed=webgl3&mute=1&renderer=3d&scale=1`);
        await gt.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
        const KINDS = ['temple_ceres', 'temple_neptune', 'temple_mercury', 'temple_mars', 'temple_venus', 'temple_large_ceres', 'temple_large_neptune', 'temple_large_mercury', 'temple_large_mars', 'temple_large_venus', 'oracle', 'mission_post'];
        const laidT = await gt.evaluate((kinds) => {
          const app = window.colonia;
          app.ui.console.run('demo 2');
          const said = app.ui.console.run('temples');
          app.paused = true;
          app.renderer.fixedTime = 0.3;
          const out = { said };
          // (The newest of each kind: the one `temples` built, joined to the road, whatever the demo built.)
          for (const t of kinds) {
            const all = [...app.game.buildings.values()].filter((v) => v.type === t);
            const b = all[all.length - 1];
            out[t] = b ? { id: b.id, x: b.x, y: b.y, size: b.size } : null;
          }
          return out;
        }, KINDS);
        const sacred = [];
        for (const type of KINDS) {
          const b = laidT[type];
          if (!b) {
            sacred.push({ type, missing: true });
            continue;
          }
          await gt.evaluate((v) => { const app = window.colonia; app.ui.info.close(); app.renderer.camera.zoomIndex = 4; app.renderer.camera.centerOnTile(v.x + v.size / 2, v.y + v.size / 2); }, b);
          await gt.waitForFunction((t) => {
            const r = window.colonia.renderer;
            const mp = r.stats.modelPass || {};
            return ((mp.byType || {})[t] || 0) >= 1 && !mp.deferred && !r.stats.pending;
          }, type, { timeout: 30000, polling: 100 }).catch(() => {});
          const drawn = await gt.evaluate((t) => (window.colonia.renderer.stats.modelPass?.byType || {})[t] || 0, type);
          const p = await gt.evaluate(([x, y]) => {
            const app = window.colonia;
            const cam = app.renderer.camera;
            const w = cam.mapToWorld(x, y);
            const r = app.canvas.getBoundingClientRect();
            return { x: r.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: r.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
          }, [b.x + b.size / 2, b.y + b.size / 2]);
          await gt.mouse.click(p.x, p.y);
          await gt.waitForFunction((id) => window.colonia.ui.info.target?.id === id, b.id, { timeout: 5000, polling: 50 }).catch(() => {});
          const target = await gt.evaluate(() => window.colonia.ui.info.target);
          sacred.push({ type, drawn, picked: target?.kind === 'building' && target.id === b.id, target });
        }
        // The people of the rites (render3d/people/): the small temple of Ceres staffed and close up draws
        // its priest, his boy and a worshipper as instanced meshes skinned on the GPU: drawn alone at two
        // clock times, their pixels change. (Waited for: their pieces are built within a frame's budget.)
        const pb = laidT.temple_ceres;
        let peopleProbe = null;
        if (pb) {
          await gt.evaluate((v) => {
            const app = window.colonia;
            app.game.buildings.get(v.id).efficiency = 1;
            app.ui.info.close();
            app.renderer.camera.zoomIndex = 7;
            app.renderer.camera.centerOnTile(v.x + v.size / 2, v.y + v.size / 2);
          }, pb);
          await gt.waitForFunction(() => {
            const r = window.colonia.renderer;
            const mp = r.stats.modelPass || {};
            return mp.people >= 3 && !mp.deferred && !r.stats.pending;
          }, null, { timeout: 30000, polling: 100 }).catch(() => {});
          peopleProbe = await gt.evaluate(() => window.colonia.renderer.backend.probePeople([0.4, 1.3]));
        }
        check('WebGL renderer: a staffed temple\'s people are instanced meshes animated on the GPU (their pose changes with the clock)',
          !!peopleProbe && peopleProbe.people >= 3 && peopleProbe.covered.every((n) => n > 20) && peopleProbe.changed > 5, JSON.stringify(peopleProbe));
        // The buildings converted after the temples draw their people as actors too: the console's
        // `learning` builds a library; staffed and close up, its readers, scribe, librarian (on his walk
        // along the cupboards) and slave are drawn, and move with the clock. (Waited for, as above.)
        let libraryProbe = null;
        const lib = await gt.evaluate(() => {
          const app = window.colonia;
          const said = app.ui.console.run('learning');
          const b = [...app.game.buildings.values()].filter((v) => v.type === 'library').pop();
          if (!b) return { said };
          b.efficiency = 1;
          app.ui.info.close();
          app.renderer.camera.zoomIndex = 7;
          app.renderer.camera.centerOnTile(b.x + b.size / 2, b.y + b.size / 2);
          return { said, id: b.id };
        });
        if (lib.id) {
          await gt.waitForFunction(() => {
            const r = window.colonia.renderer;
            const mp = r.stats.modelPass || {};
            return ((mp.byType || {}).library || 0) >= 1 && mp.people >= 5 && !mp.deferred && !r.stats.pending;
          }, null, { timeout: 30000, polling: 100 }).catch(() => {});
          libraryProbe = await gt.evaluate(() => window.colonia.renderer.backend.probePeople([0.4, 1.3]));
        }
        check('WebGL renderer: a staffed library\'s people (readers, scribe, librarian, slave) are drawn as moving actors',
          !!libraryProbe && libraryProbe.people >= 5 && libraryProbe.covered.every((n) => n > 20) && libraryProbe.changed > 5, JSON.stringify({ lib, libraryProbe }));
        await gt.evaluate(() => window.colonia.ui.info.close());
        if (shots) await gt.screenshot({ path: path.join(shots, 'smoke-webgl-temples.png') });
        check('WebGL renderer: the five small temples, the five grand temples, the oracle and the mission post are 3D models, and a click picks each',
          sacred.length === KINDS.length && sacred.every((m) => !m.missing && m.drawn >= 1 && m.picked), JSON.stringify({ said: laidT.said, sacred }));
        check('WebGL renderer, religious models: no page errors', terrs.length === 0, terrs.join(' | '));
        await gt.close();
      }

      // 8a7. The native villages as models (render3d/models/villages.js): a sandbox with villages;
      //      the hut and the meeting place draw as models (waited for: kits are
      //      built a few a frame under the software GL) and a click on each opens its panel;
      //      the console's `villages angry` rouses them with no error.
      {
        const gv = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const verrs = [];
        gv.on('pageerror', (e) => verrs.push(`pageerror: ${e.message}`));
        gv.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) verrs.push(m.text()); });
        await gv.goto(`${url}?skipmenu=1&natives=1&map=small&seed=demo&mute=1&renderer=3d&scale=1`);
        await gv.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
        const pieces = await gv.evaluate(() => {
          const app = window.colonia;
          app.paused = true;
          app.renderer.fixedTime = 0.3;
          const out = {};
          for (const t of ['native_hut', 'native_meeting', 'native_crops']) {
            const b = [...app.game.buildings.values()].find((v) => v.type === t);
            out[t] = b ? { id: b.id, x: b.x, y: b.y, size: b.size } : null;
          }
          return out;
        });
        const village = [];
        for (const [type, b] of Object.entries(pieces)) {
          if (!b) { village.push({ type, missing: true }); continue; }
          await gv.evaluate((v) => { const app = window.colonia; app.ui.info.close(); app.renderer.camera.zoomIndex = 4; app.renderer.camera.centerOnTile(v.x + v.size / 2, v.y + v.size / 2); }, b);
          // (A plot's soil is the 3D ground's, as a farm's field: on the sprites' ground, Auto's on a
          // software GL, it keeps its sprite. Nothing to wait for: a few frames, then the click.)
          if (type === 'native_crops') await gv.waitForTimeout(400);
          else await gv.waitForFunction((t) => {
            const r = window.colonia.renderer;
            const mp = r.stats.modelPass || {};
            return ((mp.byType || {})[t] || 0) >= 1 && !mp.deferred && !r.stats.pending;
          }, type, { timeout: 30000, polling: 100 }).catch(() => {});
          const drawn = await gv.evaluate((t) => (window.colonia.renderer.stats.modelPass?.byType || {})[t] || 0, type);
          const p = await gv.evaluate(([x, y]) => {
            const app = window.colonia;
            const cam = app.renderer.camera;
            const w = cam.mapToWorld(x, y);
            const r = app.canvas.getBoundingClientRect();
            return { x: r.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: r.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
          }, [b.x + b.size / 2, b.y + b.size / 2]);
          await gv.mouse.click(p.x, p.y);
          await gv.waitForFunction((id) => window.colonia.ui.info.target?.id === id, b.id, { timeout: 5000, polling: 50 }).catch(() => {});
          const target = await gv.evaluate(() => window.colonia.ui.info.target);
          village.push({ type, drawn, picked: target?.kind === 'building' && target.id === b.id });
        }
        const roused = await gv.evaluate(() => { const app = window.colonia; app.ui.info.close(); return app.ui.console.run('villages angry'); });
        await gv.waitForTimeout(500);
        if (shots) await gv.screenshot({ path: path.join(shots, 'smoke-webgl-villages.png') });
        check('WebGL renderer: a native village\'s hut and meeting place are 3D models, its plot its sprite on the sprites\' ground, and a click picks each',
          village.length === 3 && village.every((v) => !v.missing && v.picked && (v.type === 'native_crops' ? v.drawn === 0 : v.drawn >= 1)), JSON.stringify({ village, roused }));
        check('WebGL renderer, village models: no page errors', verrs.length === 0 && /villages angry/.test(roused), verrs.join(' | ') || roused);
        await gv.close();
      }

      // 8a2. The walkers as 3D people (render3d/walkers/): while the models draw, a walker in view
      //      is drawn by the walkers' pass (its click spot then reaches over what goes with him),
      //      not as a sprite; a click on him opens his panel. Waited for by state: his pieces are
      //      built a few a frame, and the programs compile in the background under the software GL.
      {
        const gw = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const werrs = [];
        gw.on('pageerror', (e) => werrs.push(`pageerror: ${e.message}`));
        gw.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) werrs.push(m.text()); });
        await gw.goto(`${url}?skipmenu=1&map=small&seed=webgl3&mute=1&renderer=3d&scale=1`);
        await gw.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
        const pickOne = () => gw.evaluate(() => {
          const app = window.colonia;
          const g = app.game;
          // A roamer on a road with plenty of walk left, in the middle of the view.
          const w = [...g.walkers.values()].filter((v) => v.kind === 'roamer' && g.map.road[g.map.idx(v.x, v.y)] && (v.roamLeft ?? 0) > 10)[0]
            || [...g.walkers.values()].find((v) => v.kind !== 'ship' && g.map.road[g.map.idx(v.x, v.y)]);
          if (!w) return null;
          app.renderer.camera.zoomIndex = 5;
          app.renderer.camera.centerOnTile(w.x, w.y);
          return { id: w.id, type: w.type };
        });
        await gw.evaluate(() => { const app = window.colonia; app.ui.console.run('demo 2'); app.game.runDays(40); app.paused = true; });
        let wk = await pickOne();
        // Drawn in 3D: the walkers' pass ready, his spot one of the 3D walkers' (it has a reach), his pieces built.
        const in3d = (id) => gw.waitForFunction((v) => {
          const r = window.colonia.renderer;
          const s = r.walkerSpots.find((q) => q.id === v);
          return !!s && s.reachX !== undefined && r.stats.walkers3d && r.stats.walkers3d.walkers >= 1 && !r.stats.walkers3d.deferred;
        }, id, { timeout: 60000, polling: 100 }).then(() => true, () => false);
        let drawn3d = wk ? await in3d(wk.id) : false;
        if (wk && !drawn3d) {
          // (He may have gone home meanwhile: another.)
          wk = await pickOne();
          drawn3d = wk ? await in3d(wk.id) : false;
        }
        let wpanel = null;
        let wstats = null;
        if (wk && drawn3d) {
          wstats = await gw.evaluate((id) => {
            const r = window.colonia.renderer;
            return { ...r.stats.walkers3d, sprite: r.walkers3d.some((it) => it.w.id === id) ? 'none' : 'sprite' };
          }, wk.id);
          const p = await gw.evaluate((id) => {
            const app = window.colonia;
            const cam = app.renderer.camera;
            const s = app.renderer.walkerSpots.find((q) => q.id === id);
            const q = cam.toScreen(s.wx, s.wy - 9);
            const rect = app.canvas.getBoundingClientRect();
            return { x: rect.left + q.x / cam.dpr, y: rect.top + q.y / cam.dpr };
          }, wk.id);
          await gw.mouse.click(p.x, p.y);
          await gw.waitForFunction((id) => window.colonia.ui.info.target?.id === id, wk.id, { timeout: 5000, polling: 50 }).catch(() => {});
          wpanel = await gw.evaluate(() => ({ target: window.colonia.ui.info.target, ring: window.colonia.renderer.selectedWalker }));
        }
        if (shots) await gw.screenshot({ path: path.join(shots, 'smoke-webgl-walkers.png') });
        check('WebGL renderer: walkers are drawn as 3D people (instanced, not sprites), and a click on one opens his panel',
          !!wk && drawn3d && wstats.walkers >= 1 && wstats.figures >= 1 && wstats.draws >= 1 && wstats.triangles > 0 && wstats.sprite === 'none'
            && wpanel?.target?.kind === 'walker' && wpanel.target.id === wk.id && wpanel.ring === wk.id,
          JSON.stringify({ wk, drawn3d, wstats, wpanel }));
        check('WebGL renderer, 3D walkers: no page errors', werrs.length === 0, werrs.join(' | '));
        await gw.close();
      }

      // 8a3. The land units as 3D figures (render3d/units/): while the models draw, a soldier in
      //      view is drawn by the units' pass (no sprite), and a click on him still picks him.
      //      Waited for by state: his pieces are built a few a frame, the programs compile in the
      //      background under the software GL.
      {
        const gu = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const uerrs = [];
        gu.on('pageerror', (e) => uerrs.push(`pageerror: ${e.message}`));
        gu.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) uerrs.push(m.text()); });
        await gu.goto(`${url}?skipmenu=1&map=small&seed=webgl3&mute=1&renderer=3d&scale=1`);
        await gu.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
        const sol = await gu.evaluate(() => {
          const app = window.colonia;
          app.paused = true;
          const c = app.ui.console;
          c.run('demo 2');
          c.run('garrison');
          let u = null;
          for (let d = 0; d < 120 && !u; d++) {
            c.run('days 1');
            u = [...app.game.units.values()].find((v) => v.side === 'rome' && !v.moving);
          }
          if (!u) return null;
          app.renderer.camera.zoomIndex = 5;
          app.renderer.camera.centerOnTile(u.x, u.y);
          return { id: u.id, type: u.type };
        });
        // Drawn in 3D: the units' pass ready, his figure among those it drew, its pieces built.
        const drawn = sol ? await gu.waitForFunction((id) => {
          const r = window.colonia.renderer;
          const p = r.backend.units;
          const s = r.stats.units3d;
          return !!s && s.units >= 1 && !s.deferred && r.unitSpots.some((q) => q.id === id) && p.list.slice(0, p.used).some((it) => it.u && it.u.id === id);
        }, sol.id, { timeout: 90000, polling: 100 }).then(() => true, () => false) : false;
        let upanel = null;
        let ustats = null;
        if (drawn) {
          ustats = await gu.evaluate(() => ({ ...window.colonia.renderer.stats.units3d }));
          const p = await gu.evaluate((id) => {
            const app = window.colonia;
            const cam = app.renderer.camera;
            const s = app.renderer.unitSpots.find((q) => q.id === id);
            const q = cam.toScreen(s.wx, s.wy - 9);
            const rect = app.canvas.getBoundingClientRect();
            return { x: rect.left + q.x / cam.dpr, y: rect.top + q.y / cam.dpr };
          }, sol.id);
          await gu.mouse.click(p.x, p.y);
          await gu.waitForFunction((id) => window.colonia.ui.info.target?.id === id, sol.id, { timeout: 5000, polling: 50 }).catch(() => {});
          upanel = await gu.evaluate(() => window.colonia.ui.info.target);
        }
        if (shots) await gu.screenshot({ path: path.join(shots, 'smoke-webgl-units.png') });
        check('WebGL renderer: land units are drawn as 3D figures (instanced, not sprites), and a click on one picks him',
          !!sol && drawn && ustats.figures >= 1 && ustats.draws >= 1 && ustats.triangles > 0 && upanel?.kind === 'unit' && upanel.id === sol.id,
          JSON.stringify({ sol, drawn, ustats, upanel }));
        check('WebGL renderer, 3D units: no page errors', uerrs.length === 0, uerrs.join(' | '));
        await gu.close();
      }

      // 8a7. The venues as models (render3d/models/venues.js): the console's `shows` builds an
      //      Arena, an amphitheater and a Circus beside the demo city (its theater stands) and
      //      books every show; paused and staffed, each draws as a model (waited for: kits are built
      //      a few a frame under the software GL), its show's figures go to the units' pass (the
      //      gladiators, the race), and a click on its footprint (any section of the Circus) opens
      //      its panel.
      {
        const gv = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const verrs = [];
        gv.on('pageerror', (e) => verrs.push(`pageerror: ${e.message}`));
        gv.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) verrs.push(m.text()); });
        await gv.goto(`${url}?skipmenu=1&map=small&seed=webgl3&mute=1&renderer=3d&scale=1`);
        await gv.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
        const laidV = await gv.evaluate(() => {
          const app = window.colonia;
          app.ui.console.run('demo 2');
          const free = app.game.cheats.freeBuild;
          app.game.cheats.freeBuild = true;
          const said = app.ui.console.run('shows');
          app.game.cheats.freeBuild = free;
          app.paused = true;
          app.renderer.fixedTime = 0.3;
          const all = [...app.game.buildings.values()];
          // (Staffed for the check: the demo's labour reaches them in its own time.)
          for (const b of all) if (b.def.kind === 'venue') b.efficiency = 1;
          const pick = (t) => {
            const b = all.find((v) => v.type === t);
            return b ? { id: b.id, main: b.main || b.id, type: b.type, x: b.x, y: b.y, size: b.size } : null;
          };
          return { said, list: ['theater', 'amphitheater', 'colosseum', 'hippodrome', 'hippodrome_part'].map(pick) };
        });
        const venues = [];
        for (const b of laidV.list) {
          if (!b) {
            venues.push({ missing: true });
            continue;
          }
          await gv.evaluate((v) => { const app = window.colonia; app.ui.info.close(); app.renderer.camera.zoomIndex = 4; app.renderer.camera.centerOnTile(v.x + v.size / 2, v.y + v.size / 2); }, b);
          // Drawn as a model, and (at the arenas and the Circus) its show's figures drawn by the units' pass.
          const shows = b.type === 'colosseum' || b.type === 'amphitheater' || b.type === 'hippodrome';
          await gv.waitForFunction(([t, shows]) => {
            const r = window.colonia.renderer;
            const mp = r.stats.modelPass || {};
            const u = r.stats.units3d;
            return ((mp.byType || {})[t] || 0) >= 1 && !mp.deferred && !r.stats.pending && (!shows || (!!u && u.figures >= 2 && !u.deferred));
          }, [b.type, shows], { timeout: 60000, polling: 100 }).catch(() => {});
          // (Its own show's figures: made-up units with ids from the venue's own, render3d/models/venueShow.js showIds.)
          const got = await gv.evaluate(([t, id]) => {
            const r = window.colonia.renderer;
            const p = r.backend.units;
            const top = -1000000 - id * 16;
            const own = p.list.slice(0, p.used).filter((it) => it.u && it.u.id <= top && it.u.id > top - 16).length;
            return { drawn: (r.stats.modelPass?.byType || {})[t] || 0, figures: own };
          }, [b.type, b.main]);
          const p = await gv.evaluate(([x, y]) => {
            const app = window.colonia;
            const cam = app.renderer.camera;
            const w = cam.mapToWorld(x, y);
            const r = app.canvas.getBoundingClientRect();
            return { x: r.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: r.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
          }, [b.x + b.size / 2, b.y + b.size / 2]);
          await gv.mouse.click(p.x, p.y);
          await gv.waitForFunction((id) => window.colonia.ui.info.target?.id === id, b.main, { timeout: 5000, polling: 50 }).catch(() => {});
          const target = await gv.evaluate(() => window.colonia.ui.info.target);
          venues.push({ type: b.type, ...got, shows, picked: target?.kind === 'building' && target.id === b.main });
        }
        await gv.evaluate(() => window.colonia.ui.info.close());
        if (shots) await gv.screenshot({ path: path.join(shots, 'smoke-webgl-venues.png') });
        check('WebGL renderer: the theater, the amphitheater, the Great Arena and the Circus\'s sections are 3D models with their shows, and a click picks each',
          venues.length === 5 && venues.every((v) => !v.missing && v.drawn >= 1 && v.picked && (!v.shows || v.figures >= 2)), JSON.stringify({ said: laidV.said, venues }));
        check('WebGL renderer, venue models: no page errors', verrs.length === 0, verrs.join(' | '));
        await gv.close();
      }

      // 8a8. monuments-site: the work camp and the Hall of Justice as models (render3d/models/
      //      monumentModels.js): the console's `monument basilica` lays a basilica's site, a work camp,
      //      a well and a warehouse beside the demo city; paused, staffed, each draws as a model
      //      (waited for: kits are built a few a frame under the software GL) and a click on its
      //      footprint opens its panel.
      {
        const gm = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
        const merrs = [];
        gm.on('pageerror', (e) => merrs.push(`pageerror: ${e.message}`));
        gm.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) merrs.push(m.text()); });
        await gm.goto(`${url}?skipmenu=1&map=small&seed=webgl3&mute=1&renderer=3d&scale=1`);
        await gm.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
        const laidM = await gm.evaluate(() => {
          const app = window.colonia;
          app.ui.console.run('demo 2');
          const free = app.game.cheats.freeBuild;
          app.game.cheats.freeBuild = true;
          const said = app.ui.console.run('monument basilica');
          app.game.cheats.freeBuild = free;
          app.paused = true;
          app.renderer.fixedTime = 0.3;
          const all = [...app.game.buildings.values()];
          const pick = (t) => {
            const b = all.find((v) => v.type === t);
            if (b) b.efficiency = 1;
            return b ? { id: b.id, type: b.type, x: b.x, y: b.y, size: b.size } : null;
          };
          return { said, list: ['basilica', 'work_camp'].map(pick) };
        });
        const mons = [];
        for (const b of laidM.list) {
          if (!b) {
            mons.push({ missing: true });
            continue;
          }
          await gm.evaluate((v) => { const app = window.colonia; app.ui.info.close(); app.renderer.camera.zoomIndex = 4; app.renderer.camera.centerOnTile(v.x + v.size / 2, v.y + v.size / 2); }, b);
          await gm.waitForFunction((t) => {
            const r = window.colonia.renderer;
            const mp = r.stats.modelPass || {};
            return ((mp.byType || {})[t] || 0) >= 1 && !mp.deferred && !r.stats.pending;
          }, b.type, { timeout: 60000, polling: 100 }).catch(() => {});
          const drawn = await gm.evaluate((t) => (window.colonia.renderer.stats.modelPass?.byType || {})[t] || 0, b.type);
          const p = await gm.evaluate(([x, y]) => {
            const app = window.colonia;
            const cam = app.renderer.camera;
            const w = cam.mapToWorld(x, y);
            const r = app.canvas.getBoundingClientRect();
            return { x: r.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: r.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
          }, [b.x + b.size / 2, b.y + b.size / 2]);
          await gm.mouse.click(p.x, p.y);
          await gm.waitForFunction((id) => window.colonia.ui.info.target?.id === id, b.id, { timeout: 5000, polling: 50 }).catch(() => {});
          const target = await gm.evaluate(() => window.colonia.ui.info.target);
          mons.push({ type: b.type, drawn, picked: target?.kind === 'building' && target.id === b.id });
        }
        await gm.evaluate(() => window.colonia.ui.info.close());
        if (shots) await gm.screenshot({ path: path.join(shots, 'smoke-webgl-monuments-site.png') });
        check('WebGL renderer: the Hall of Justice\'s site and the work camp are 3D models, and a click picks each',
          mons.length === 2 && mons.every((v) => !v.missing && v.drawn >= 1 && v.picked), JSON.stringify({ said: laidM.said, mons }));
        check('WebGL renderer, monuments-site models: no page errors', merrs.length === 0, merrs.join(' | '));
        await gm.close();
      }

      // 8b. The 3D ground (render3d/ground/): Auto keeps the flat sprites on a
      //     software GL (this browser's), so the console asks for Low. It
      //     draws, keeps its picture while nothing moves, a click still picks
      //     a tile and a building, an overlay's tint shows over it, and a view
      //     turn draws it again with picking still true.
      const gq = await glBrowser.newPage({ viewport: { width: 1280, height: 800 } });
      const qerrors = [];
      gq.on('pageerror', (e) => qerrors.push(`pageerror: ${e.message}`));
      gq.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) qerrors.push(m.text()); });
      // The render scale pinned at 100%: under CI's software GL its Auto steps down as frames run
      // slow, and a new scale is a change the ground rightly draws again for, which broke the
      // still-view check below (v0.20.15: 1 -> 2 redraws in a still view).
      await gq.goto(`${url}?skipmenu=1&map=small&seed=webgl3&mute=1&renderer=3d&scale=1`);
      await gq.waitForFunction(() => window.colonia && window.colonia.game && window.colonia.renderer.stats.backend === 'webgl', null, { timeout: 30000 });
      const autoGround = await gq.evaluate(() => window.colonia.renderer.stats.ground);
      check('3D ground: Auto keeps the flat sprites on a software GL', autoGround === 'off', String(autoGround));
      const site = await gq.evaluate(() => {
        const app = window.colonia;
        app.ui.console.run('demo 2');
        app.paused = true;
        app.renderer.fixedTime = 0.3;
        app.ui.console.run('ground low');
        const g = app.game;
        const w = [...g.buildings.values()].find((b) => b.type === 'well');
        // An open tile near the well: no building, no road, dry land.
        let open = null;
        for (let r = 2; r < 12 && !open; r++) {
          for (let dy = -r; dy <= r && !open; dy++) {
            for (let dx = -r; dx <= r && !open; dx++) {
              const x = w.x + dx;
              const y = w.y + dy;
              const i = g.map.idx(x, y);
              if (g.map.inBounds(x, y) && !g.map.building[i] && !g.map.road[i] && g.map.terrain[i] !== 4 && g.map.terrain[i] !== 2 && g.map.terrain[i] !== 3) open = { x, y };
            }
          }
        }
        app.renderer.camera.zoomIndex = 3;
        app.renderer.camera.centerOnTile(w.x, w.y);
        return { well: { id: w.id, x: w.x, y: w.y }, open };
      });
      await gq.waitForFunction(() => window.colonia.renderer.stats.ground === 'low', null, { timeout: 60000 }).catch(() => {});
      // The ground's layers are painted on the GPU (here SwiftShader's) before the ground draws.
      await gq.waitForFunction(() => window.colonia.renderer.stats.groundTexReady, null, { timeout: 60000 }).catch(() => {});
      const painted = await gq.evaluate(() => {
        const r = window.colonia.renderer;
        return { ready: r.stats.groundTexReady, ground: r.stats.ground, out: window.colonia.ui.console.run('textures') };
      });
      check('3D ground: its texture layers are painted on the GPU before it draws', painted.ready === true && new RegExp(`${N_GROUND}/${N_GROUND} layers in`).test(painted.out) && new RegExp(`\\(${N_GROUND} ground layers`).test(painted.out), JSON.stringify(painted));
      await gq.waitForTimeout(500);
      const lowDrawn = await gq.evaluate(() => {
        const r = window.colonia.renderer;
        const d = r.composedImage().data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 4 * 997) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        // (The city's things: its sprites and its 3D models. A building drawn as a model has no sprite
        // in the list, so with the demo city's temples drawn as models the sprites alone fell under 50.)
        return { ground: r.stats.ground, backend: r.stats.backend, colours: seen.size, redraws: r.stats.groundRedraws, objects: r.stats.objects + (r.stats.models || 0) };
      });
      if (shots) await gq.screenshot({ path: path.join(shots, 'smoke-ground3d.png') });
      check('3D ground: the console\'s "ground low" draws the 3D ground under the city', lowDrawn.ground === 'low' && lowDrawn.backend === 'webgl' && lowDrawn.colours > 50 && lowDrawn.redraws >= 1 && lowDrawn.objects > 50, JSON.stringify(lowDrawn));
      const scaleThen = await gq.evaluate(() => window.colonia.ui.console.run('scale'));
      await gq.waitForTimeout(400);
      const still = await gq.evaluate(() => window.colonia.renderer.stats.groundRedraws);
      const scaleNow = await gq.evaluate(() => window.colonia.ui.console.run('scale'));
      check('3D ground: a still view keeps its picture (Low draws the ground again only when something changed)', still === lowDrawn.redraws, `${lowDrawn.redraws} -> ${still}; ${scaleThen} -> ${scaleNow}`);
      const onPageQ = (fx, fy) => gq.evaluate(([x, y]) => {
        const app = window.colonia;
        const cam = app.renderer.camera;
        const w = cam.mapToWorld(x, y);
        const r = app.canvas.getBoundingClientRect();
        return { x: r.left + ((w.x - cam.x) * cam.scale) / cam.dpr, y: r.top + ((w.y - cam.y) * cam.scale) / cam.dpr };
      }, [fx, fy]);
      const pickAt = async (fx, fy) => {
        await gq.evaluate(() => window.colonia.ui.info.close());
        const p = await onPageQ(fx, fy);
        await gq.mouse.click(p.x, p.y);
        await gq.waitForTimeout(200);
        return gq.evaluate(() => window.colonia.ui.info.target);
      };
      const picks3d = [];
      for (let t = 0; t < 2; t++) {
        const tile = site.open ? await pickAt(site.open.x + 0.5, site.open.y + 0.5) : null;
        const bld = await pickAt(site.well.x + 0.5, site.well.y + 0.5);
        picks3d.push({ turn: await gq.evaluate(() => window.colonia.renderer.viewTurn), tile, bld, ground: await gq.evaluate(() => window.colonia.renderer.stats.ground) });
        await gq.evaluate(() => window.colonia.ui.info.close());
        await gq.mouse.move(300, 12);
        await gq.keyboard.press('q');
        await gq.waitForTimeout(600);
      }
      check('3D ground: a click picks the open tile and the well under it, unturned and turned',
        !!site.open && picks3d.length === 2 && picks3d.every((o, t) => o.turn === t && o.ground === 'low' && o.tile?.kind === 'tile' && o.tile.x === site.open.x && o.tile.y === site.open.y && o.bld?.kind === 'building' && o.bld.id === site.well.id),
        JSON.stringify({ site, picks3d }));
      const turned = await gq.evaluate(() => window.colonia.renderer.stats.groundRedraws);
      check('3D ground: a view turn draws the ground again', turned > still, `${still} -> ${turned}`);
      // An overlay's tint over the 3D ground: the water overlay paints the well's tiles blue.
      const tint = async () => {
        const p = await onPageQ(site.well.x + 1.5, site.well.y + 0.5);
        return gq.evaluate(([x, y]) => {
          const app = window.colonia;
          const r = app.canvas.getBoundingClientRect();
          const px = Math.round((x - r.left) * app.renderer.camera.dpr);
          const py = Math.round((y - r.top) * app.renderer.camera.dpr);
          const d = app.renderer.composedImage(px - 2, py - 2, 5, 5).data;
          let rr = 0, gg = 0, bb = 0;
          for (let i = 0; i < d.length; i += 4) { rr += d[i]; gg += d[i + 1]; bb += d[i + 2]; }
          return [rr / 25, gg / 25, bb / 25].map(Math.round);
        }, [p.x, p.y]);
      };
      // Wait for what was asked to be drawn, not a fixed time: under a software GL
      // a redraw of the ground takes about half a second, and a fixed 600 ms read
      // the view before the turn back (CI, v0.20.2).
      const frames = (n) => gq.evaluate((k) => new Promise((done) => { let i = 0; const f = () => (++i >= k ? done() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
      const redraws = await gq.evaluate(() => window.colonia.renderer.stats.groundRedraws);
      const wasTurned = await gq.evaluate(() => window.colonia.renderer.viewTurn !== 0);
      await gq.evaluate(() => window.colonia.turnView(-window.colonia.renderer.viewTurn));
      if (wasTurned) await gq.waitForFunction((n) => window.colonia.renderer.stats.groundRedraws > n, redraws, { timeout: 15000 }).catch(() => {});
      // Then read once the picture holds still: two reads three frames apart that agree.
      // A fixed three frames read a picture still settling under a software GL (the
      // same overlay read [84,128,181] in one run and [115,145,163] in another).
      const settled = async () => {
        let last = await tint();
        for (let k = 0; k < 20; k++) {
          await frames(3);
          const now = await tint();
          if (now.every((v, c) => Math.abs(v - last[c]) <= 2)) return now;
          last = now;
        }
        return last;
      };
      await frames(3);
      const tintBefore = await settled();
      await gq.evaluate(() => window.colonia.setOverlay('water'));
      await frames(3);
      const tintAfter = await settled();
      await gq.evaluate(() => window.colonia.setOverlay('none'));
      if (shots) await gq.screenshot({ path: path.join(shots, 'smoke-ground3d-overlay.png') });
      check('3D ground: an overlay\'s tint shows over it (the water overlay turns the well\'s tiles blue)', tintAfter[2] - tintAfter[0] > tintBefore[2] - tintBefore[0] + 15, JSON.stringify({ tintBefore, tintAfter }));
      // The farms and the granary as models (render3d/models/farm.js, granary.js): the console's
      // "farms" builds one of every kind and a stocked granary; on the 3D ground they draw as
      // models, a click on each picks it; with the ground's sprites the farms keep theirs.
      const farmSite = await gq.evaluate(() => {
        const app = window.colonia;
        const said = app.ui.console.run('farms');
        const g = app.game;
        const olive = [...g.buildings.values()].find((b) => b.type === 'farm_olive');
        const gran = [...g.buildings.values()].filter((b) => b.type === 'granary').pop();
        if (olive) app.renderer.camera.centerOnTile(olive.x + 1.5, olive.y + 1.5);
        return { said, olive: olive && { id: olive.id, x: olive.x, y: olive.y }, gran: gran && { id: gran.id, x: gran.x, y: gran.y } };
      });
      await gq.waitForFunction(() => (window.colonia.renderer.stats.modelPass?.byType?.farm_olive || 0) > 0, null, { timeout: 30000 }).catch(() => {});
      await frames(3);
      const farmDrawn = await gq.evaluate(() => ({ byType: window.colonia.renderer.stats.modelPass?.byType || {}, ground: window.colonia.renderer.stats.ground }));
      if (shots) await gq.screenshot({ path: path.join(shots, 'smoke-farms3d.png') });
      const farmPick = farmSite.olive ? await pickAt(farmSite.olive.x + 1.5, farmSite.olive.y + 1.5) : null;
      let granPick = null;
      if (farmSite.gran) {
        await gq.evaluate((v) => window.colonia.renderer.camera.centerOnTile(v.x + 1.5, v.y + 1.5), farmSite.gran);
        await frames(3);
        granPick = await pickAt(farmSite.gran.x + 1.5, farmSite.gran.y + 1.5);
      }
      const granDrawn = await gq.evaluate(() => window.colonia.renderer.stats.modelPass?.byType?.granary || 0);
      check('3D farms: on the 3D ground a farm and the granary draw as models, and a click picks each',
        !!farmSite.olive && !!farmSite.gran && farmDrawn.byType.farm_olive >= 1 && granDrawn >= 1
          && farmPick?.kind === 'building' && farmPick.id === farmSite.olive.id && granPick?.kind === 'building' && granPick.id === farmSite.gran.id,
        JSON.stringify({ farmSite, farmDrawn, farmPick, granDrawn, granPick }));
      await gq.evaluate(() => window.colonia.ui.info.close());
      // The trees and rocks as 3D models (render3d/flora/): on the 3D ground they draw in place of
      // their sprites, and a click on a forest tile still picks that tile.
      const wood = await gq.evaluate(() => {
        const app = window.colonia;
        const m = app.game.map;
        // A forest tile with forest all round it (no road, no building).
        for (let y = 2; y < m.h - 2; y++) {
          for (let x = 2; x < m.w - 2; x++) {
            let all = true;
            for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1 && all; dx++) {
              const i = m.idx(x + dx, y + dy);
              if (m.terrain[i] !== 2 || m.road[i] || m.building[i]) all = false;
            }
            if (all) {
              app.renderer.camera.centerOnTile(x + 0.5, y + 0.5);
              return { x, y };
            }
          }
        }
        return null;
      });
      await gq.waitForFunction(() => (window.colonia.renderer.stats.flora || 0) > 0, null, { timeout: 60000 }).catch(() => {});
      await frames(3);
      const floraDrawn = await gq.evaluate(() => {
        const s = window.colonia.renderer.stats;
        return { flora: s.flora, ready: s.floraPass && s.floraPass.ready, trees: s.floraPass && s.floraPass.trees, rocks: s.floraPass && s.floraPass.rocks, said: window.colonia.ui.console.run('flora') };
      });
      if (shots) await gq.screenshot({ path: path.join(shots, 'smoke-flora3d.png') });
      const woodPick = wood ? await pickAt(wood.x + 0.5, wood.y + 0.5) : null;
      check('3D trees and rocks: on the 3D ground they draw as models in place of their sprites, and a click on a forest tile picks it',
        !!wood && floraDrawn.flora > 0 && floraDrawn.ready === true && floraDrawn.trees > 0 && /Flora: drawn/.test(floraDrawn.said)
          && woodPick?.kind === 'tile' && woodPick.x === wood.x && woodPick.y === wood.y,
        JSON.stringify({ wood, floraDrawn, woodPick }));
      await gq.evaluate(() => window.colonia.ui.info.close());
      // (Back over the granary, which the next check reads.)
      if (farmSite.gran) await gq.evaluate((v) => window.colonia.renderer.camera.centerOnTile(v.x + 1.5, v.y + 1.5), farmSite.gran);
      await gq.evaluate(() => window.colonia.ui.console.run('ground off'));
      // Waited for, not timed: the stats are the last frame's, and under a software GL with more of
      // the city drawn as models (the demo's barber and physician are models now)
      // the 400 ms once waited here read a frame from before the switch (ground "low", 0 objects).
      await gq.waitForFunction(() => { const s = window.colonia.renderer.stats; return s.ground === 'off' && s.objects > 0; }, null, { timeout: 20000, polling: 100 }).catch(() => {});
      const off = await gq.evaluate(() => ({ ground: window.colonia.renderer.stats.ground, backend: window.colonia.renderer.stats.backend, objects: window.colonia.renderer.stats.objects, flora: window.colonia.renderer.stats.flora }));
      await frames(3);
      const farmsOff = await gq.evaluate(() => window.colonia.renderer.stats.modelPass?.byType || {});
      check("3D farms: with the ground's sprites the farms keep their sprites (which draw their fields), the granary stays a model",
        !(farmsOff.farm_olive > 0) && !(farmsOff.farm_wheat > 0) && farmsOff.granary >= 1, JSON.stringify(farmsOff));
      check('3D ground: "ground off" goes back to the flat sprites (the trees and rocks too)', off.ground === 'off' && off.backend === 'webgl' && off.objects > 50 && !off.flora, JSON.stringify(off));
      check('3D ground: no page errors', qerrors.length === 0, qerrors.join(' | '));
      await gq.close();

      // 8c. The look lab (src/dev/lab.js), built here, its textures painted on the GPU (smaller:
      //     ?texscale): every one in the range of a real material, the ground's layers tiling with
      //     their height in the alpha, the paving's height read back, and all of them painted
      //     again, the same, after a lost WebGL context.
      const labFile = path.join(os.tmpdir(), `colonia-lab-smoke-${process.pid}.html`);
      execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs'), '--lab', '--out', labFile], { stdio: 'pipe' });
      const lp = await glBrowser.newPage({ viewport: { width: 960, height: 600 } });
      const lerrors = [];
      lp.on('pageerror', (e) => lerrors.push(`pageerror: ${e.message}`));
      lp.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) lerrors.push(m.text()); });
      try {
        await lp.goto(`${pathToFileURL(labFile).href}?texscale=0.25`);
        await lp.waitForFunction(() => window.__lab && window.__lab.timings.firstFrame, null, { timeout: 120000 });
        const rep1 = await lp.evaluate(() => window.__lab.textureReport());
        const bad = Object.entries(rep1).filter(([k, v]) => {
          if (k === 'pavingHeight') return !(v > 0);
          if (/ripples/.test(k)) return v.flat < 200; // (only a normal map)
          const real = v.lum > 0.02 && v.lum < 0.8 && v.rough > 0.2 && v.rough <= 1;
          if (k.startsWith('ground.')) return !real || v.alpha[0] !== 0 || v.alpha[1] !== 255 || !v.seamless;
          // (A spray of leaves is cut out by its alpha: none between the leaves, all on them.)
          if (SURFACES[k.slice('surface.'.length)]?.alpha) return !real || v.alpha[0] !== 0 || v.alpha[1] !== 255;
          return !real || v.alpha[0] !== 255;
        });
        check('look lab: every texture painted on the GPU is a real material\'s, the ground\'s tile with their height in the alpha, the sprays cut out by theirs', Object.keys(rep1).length === N_TEXTURES + 1 && bad.length === 0, JSON.stringify(bad.length ? bad : Object.keys(rep1).length));
        const repainted = await lp.evaluate(() => window.__lab.loseContext());
        const rep2 = await lp.evaluate(() => window.__lab.textureReport());
        const changed = Object.keys(rep1).filter((k) => JSON.stringify(rep1[k]) !== JSON.stringify(rep2[k]));
        check('look lab: a lost WebGL context paints every texture again, the same', repainted >= N_TEXTURES && changed.length === 0, JSON.stringify({ repainted, changed }));
        check('look lab: no page errors', lerrors.length === 0, lerrors.join(' | '));
      } finally {
        await lp.close();
        fs.rmSync(labFile, { force: true });
      }
    } finally {
      await glBrowser.close();
    }
  }

  check('no page errors overall', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
