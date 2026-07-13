const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = __dirname;
const configPath = path.join(root, 'config.json');
const playerCachePath = path.join(root, '.player-cache.json');
const dailyStatsPath = path.join(root, '.daily-stats.json');
const reportsPath = path.join(root, '.reports.json');
const localesPath = path.join(root, 'public', 'locales');
if (!fs.existsSync(configPath)) fs.copyFileSync(path.join(root, 'config.example.json'), configPath);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const indexHtml = fs.readFileSync(path.join(root, 'public', 'index.html'));
const logoImage = fs.readFileSync(path.join(root, 'public', 'exadious-logo.png'));
const botSource = fs.readFileSync(path.join(root, 'Tanoth.js'), 'utf8');
const supportedLocales = ['de-DE', 'en-EN', 'fr-FR', 'es-ES'];
if (!supportedLocales.includes(config.uiLocale)) config.uiLocale = 'en-EN';
let cachedPlayer = {};
try { cachedPlayer = JSON.parse(fs.readFileSync(playerCachePath, 'utf8')); } catch {}
const currentDayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const emptyDailyStats = () => ({ goldCollected: 0, experienceGained: 0, adventuresCompleted: 0, bloodstonesSpent: 0, attributesBought: 0, circleItemsBought: 0, errors: 0, runtimeMs: 0 });
let savedReports = { combat: null, adventure: null, dungeon: null, work: null };
try { savedReports = { ...savedReports, ...JSON.parse(fs.readFileSync(reportsPath, 'utf8')) }; } catch {}
let dailyStore = { date: currentDayKey(), stats: emptyDailyStats(), samples: { gold: null, bloodstones: null, experience: null, adventures: null } };
try {
  const saved = JSON.parse(fs.readFileSync(dailyStatsPath, 'utf8'));
  if (saved.date === currentDayKey()) dailyStore = { ...dailyStore, ...saved, stats: { ...emptyDailyStats(), ...saved.stats }, samples: { ...dailyStore.samples, ...saved.samples } };
} catch {}

const allowedBotSettings = {
  server_speed: value => Number.isFinite(value) && value > 0 && value <= 100,
  priorityAdventure: value => ['experience', 'gold'].includes(value),
  difficulty: value => ['easy', 'medium', 'difficult', 'very_difficult'].includes(value),
  spendGoldOn: value => ['attributes', 'circle'].includes(value),
  priorityAttribute: value => ['MIX', 'STR', 'DEX', 'CON', 'INT'].includes(value),
  minGoldToSpend: value => Number.isInteger(value) && value >= 0,
  useBloodstones: value => typeof value === 'boolean',
  minBloodstonesToSpend: value => Number.isInteger(value) && value >= 0,
  autoEquipPlayer: value => typeof value === 'boolean',
  autoEquipCompanions: value => typeof value === 'boolean',
  enablePvp: value => typeof value === 'boolean',
  pvpLimitType: value => ['rank', 'level', 'both'].includes(value),
  pvpMaxRankDifference: value => Number.isInteger(value) && value >= 0,
  pvpMaxLevelDifference: value => Number.isInteger(value) && value >= 0,
  pvpOpponentLevelBelow: value => Number.isInteger(value) && value >= 1,
  enableDungeon: value => typeof value === 'boolean',
  dungeonUseBloodstones: value => typeof value === 'boolean',
  dungeonMinBloodstones: value => Number.isInteger(value) && value >= 0,
  autoSell: value => typeof value === 'boolean',
  autoSellRarity: value => ['common', 'non_unique', 'all'].includes(value),
  autoSellMinValue: value => Number.isInteger(value) && value >= 0,
  autoSellKeepAttributes: value => Array.isArray(value) && value.every(attribute => ['STR', 'DEX', 'CON', 'INT'].includes(attribute))
};

const state = {
  mode: 'deactivated', message: 'Bot nicht gestartet', collecting: 0,
  online: 0, offline: 0, deactivated: 1, gold: null, bloodstones: null,
  player: { name: null, level: null, strength: null, dexterity: null, constitution: null, intelligence: null, image: null, ...cachedPlayer },
  startedAt: null, updatedAt: new Date().toISOString(), logs: [],
  dailyStats: dailyStore.stats, reports: savedReports
};
const statBaseline = dailyStore.samples;
let lastStatsTick = Date.now();
let context;
let page;
let botFrame;

async function applyGameLocale(locale) {
  if (!supportedLocales.includes(locale) || !botFrame) return;
  const gameLanguage = { 'de-DE': 'de', 'en-EN': 'en', 'fr-FR': 'fr', 'es-ES': 'es' }[locale];
  await botFrame.evaluate(({ locale, gameLanguage }) => {
    globalThis.__TANOTH_LOCALE__ = locale;
    globalThis.__TANOTH_GAME_LANGUAGE__ = gameLanguage;
    for (const candidate of [globalThis.flashvars, globalThis.flashVars, globalThis.FLASHVARS]) {
      if (!candidate || typeof candidate !== 'object') continue;
      candidate.language = gameLanguage;
      candidate.lang = gameLanguage;
      candidate.locale = locale;
    }
    try {
      localStorage.setItem('language', gameLanguage);
      localStorage.setItem('lang', gameLanguage);
      localStorage.setItem('locale', locale);
    } catch {}
  }, { locale, gameLanguage }).catch(error => log(`Spielsprache konnte nicht gesetzt werden: ${error.message}`));
}

function update(patch) {
  const now = Date.now();
  if (dailyStore.date !== currentDayKey()) {
    dailyStore = { date: currentDayKey(), stats: emptyDailyStats(), samples: { gold: null, bloodstones: null, experience: null, adventures: null } };
    state.dailyStats = dailyStore.stats;
    Object.assign(statBaseline, dailyStore.samples);
  }
  if (state.mode === 'collecting') state.dailyStats.runtimeMs += Math.max(0, now - lastStatsTick);
  lastStatsTick = now;
  if (patch.statsEvent) {
    for (const [key, amount] of Object.entries(patch.statsEvent)) {
      if (key in state.dailyStats && Number.isFinite(amount)) state.dailyStats[key] += amount;
    }
    patch = { ...patch };
    delete patch.statsEvent;
  }
  if (patch.player) {
    const definedPlayerValues = Object.fromEntries(
      Object.entries(patch.player).filter(([, value]) => value !== null && value !== undefined && value !== '')
    );
    if (definedPlayerValues.pictureId && !definedPlayerValues.image) {
      definedPlayerValues.image = new URL(
        `/assets/gfx/face/small${definedPlayerValues.pictureId}.jpg`,
        config.serverUrl
      ).toString();
    }
    patch = { ...patch, player: { ...state.player, ...definedPlayerValues } };
    if (Object.keys(definedPlayerValues).length > 0) {
      const cacheablePlayer = Object.fromEntries(Object.entries(patch.player).filter(([key]) => !['companions', 'companionDiagnostics'].includes(key)));
      fs.writeFileSync(playerCachePath, `${JSON.stringify(cacheablePlayer, null, 2)}\n`, 'utf8');
    }
  }
  if (patch.reports) {
    patch = { ...patch, reports: { ...state.reports, ...patch.reports } };
    fs.writeFileSync(reportsPath, `${JSON.stringify(patch.reports, null, 2)}\n`, 'utf8');
  }
  Object.assign(state, patch, { updatedAt: new Date().toISOString() });
  const samples = { gold: state.gold, bloodstones: state.bloodstones, experience: state.player?.experience, adventures: state.player?.adventuresMade };
  if (Number.isFinite(samples.gold) && Number.isFinite(statBaseline.gold) && samples.gold > statBaseline.gold) state.dailyStats.goldCollected += samples.gold - statBaseline.gold;
  if (Number.isFinite(samples.bloodstones) && Number.isFinite(statBaseline.bloodstones) && samples.bloodstones < statBaseline.bloodstones) state.dailyStats.bloodstonesSpent += statBaseline.bloodstones - samples.bloodstones;
  if (Number.isFinite(samples.experience) && Number.isFinite(statBaseline.experience) && samples.experience > statBaseline.experience) state.dailyStats.experienceGained += samples.experience - statBaseline.experience;
  if (Number.isFinite(samples.adventures) && Number.isFinite(statBaseline.adventures) && samples.adventures > statBaseline.adventures) state.dailyStats.adventuresCompleted += samples.adventures - statBaseline.adventures;
  for (const [key, value] of Object.entries(samples)) if (Number.isFinite(value)) statBaseline[key] = value;
  state.collecting = state.mode === 'collecting' ? 1 : 0;
  state.online = state.mode === 'online' || state.mode === 'collecting' ? 1 : 0;
  state.offline = state.mode === 'offline' ? 1 : 0;
  state.deactivated = state.mode === 'deactivated' ? 1 : 0;
  dailyStore.stats = state.dailyStats;
  dailyStore.samples = statBaseline;
  fs.writeFileSync(dailyStatsPath, `${JSON.stringify(dailyStore, null, 2)}\n`, 'utf8');
}

function log(message) {
  const line = `${new Date().toLocaleTimeString('de-DE')} ${message}`;
  state.logs.unshift(line);
  state.logs = state.logs.slice(0, 80);
  console.log(line);
  if (/\b(error|fehler|exception|failed)\b/i.test(message) && !/no_valid_session/i.test(message)) state.dailyStats.errors += 1;
  dailyStore.stats = state.dailyStats;
  fs.writeFileSync(dailyStatsPath, `${JSON.stringify(dailyStore, null, 2)}\n`, 'utf8');
}

setInterval(() => {
  const now = Date.now();
  if (state.mode === 'collecting') state.dailyStats.runtimeMs += Math.max(0, now - lastStatsTick);
  lastStatsTick = now;
  dailyStore.stats = state.dailyStats;
  dailyStore.samples = statBaseline;
  fs.writeFileSync(dailyStatsPath, `${JSON.stringify(dailyStore, null, 2)}\n`, 'utf8');
}, 5000);

function isHiddenBrowserMessage(message) {
  return [
    /^Estimated time:/i,
    /^Waiting for \d+ seconds/i,
    /^Another task is running:/i,
    /^Task time is NaN/i,
    /^Starting new adventure cycle/i,
    /^Not enough gold to buy/i,
    /^Item cost:/i,
    /^Current (gold|bloodstones):/i,
    /^Best item to buy:/i,
    /^Starting circle process/i,
    /^Circle data incomplete; available nodes: keine/i,
    /^Player attribute fields:/i,
    /^Player attribute parts:/i,
    /^Player mount data:/i,
    /^Inventardaten:/i,
    /An iframe which has both allow-scripts and allow-same-origin/i,
    /<link rel=preload> has an invalid [`']?href[`']? value/i,
    /^Starting bot process/i,
    /^\[\.WebGL-/i,
    /GL Driver Message/i,
    /GPU stall due to ReadPixels/i
  ].some(pattern => pattern.test(message.trim()));
}

function visibleLogs() {
  return state.logs.filter(line => {
    const browserMessage = line.replace(/^\d{2}:\d{2}:\d{2}\s+\[Browser\]\s*/, '');
    return !isHiddenBrowserMessage(browserMessage);
  });
}

async function ensureBrowser() {
  if (page && !page.isClosed()) return page;
  update({ mode: 'online', message: 'Browser wird gestartet' });
  context = await chromium.launchPersistentContext(path.join(root, '.browser-profile'), {
    headless: true,
    viewport: { width: 1280, height: 900 }
  });
  await context.exposeFunction('__tanothStatus', payload => update(payload));
  const wirePage = currentPage => {
    currentPage.on('console', msg => {
      const message = msg.text();
      if (!isHiddenBrowserMessage(message)) log(`[Browser] ${message}`);
    });
    currentPage.on('pageerror', error => log(`[Seitenfehler] ${error.message}`));
  };
  context.on('page', wirePage);
  page = context.pages()[0] || await context.newPage();
  context.pages().forEach(wirePage);
  page.on('close', () => update({ mode: 'offline', message: 'Browser wurde geschlossen' }));
  await page.goto(config.serverUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return page;
}

async function findClientFrame(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const currentPage of context.pages()) {
      for (const frame of currentPage.frames()) {
        try {
          const found = await frame.evaluate(() => {
            const candidates = [globalThis.flashvars, globalThis.flashVars, globalThis.FLASHVARS];
            const value = candidates.find(item => item && (item.sessionID || item.sessionId));
            if (!value) return false;
            globalThis.flashvars = { ...value, sessionID: value.sessionID || value.sessionId };
            return Boolean(globalThis.flashvars.sessionID);
          });
          if (found) {
            page = currentPage;
            return frame;
          }
        } catch {
          // Navigating frames are retried.
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return null;
}

async function launchGameFromLobby() {
  for (let step = 0; step < 4; step++) {
    const lobbyPage = context.pages().find(candidate => candidate.url().includes('lobby.tanoth.gameforge.com'));
    if (!lobbyPage) return true;
    const route = new URL(lobbyPage.url()).pathname;
    update({ mode: 'online', message: `Tanoth-Lobby wird vorbereitet (${route})` });
    await lobbyPage.waitForTimeout(1500);

    const controls = lobbyPage.locator('a:visible, button:visible, [role="button"]:visible');
    const candidates = await controls.evaluateAll(elements => elements.map((element, index) => ({
      index,
      text: (element.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || '').trim().replace(/\s+/g, ' '),
      href: element.getAttribute('href') || ''
    })).filter(item => item.text || item.href));

    const blocked = /logout|log out|abmelden|settings|einstellungen|support|forum|privacy|impressum|register/i;
    const ranked = candidates
      .filter(item => !blocked.test(`${item.text} ${item.href}`))
      .map(item => {
        let score = 0;
        const value = `${item.text} ${item.href}`;
        if (/play|spielen|spiel starten|launch|continue|weiter/i.test(value)) score += 100;
        if (/\/hub/i.test(item.href)) score += 80;
        if (/select|auswählen|account|character|charakter/i.test(value)) score += 50;
        if (route.includes('/accounts') && /account|server|world|welt|s4|deutsch/i.test(value)) score += 30;
        if (item.text) score += 1;
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score);

    const selected = ranked[0];
    if (!selected || selected.score <= 1) {
      const labels = candidates.slice(0, 12).map(item => item.text || item.href).join(' | ');
      log(`Lobby-Elemente: ${labels || 'keine'}`);
      update({ mode: 'offline', message: `Lobby-Auswahl nicht erkannt (${route}); Details stehen im Protokoll` });
      return false;
    }

    log(`Lobby: ${selected.text || selected.href} wird ausgewählt`);
    await controls.nth(selected.index).click();
    await lobbyPage.waitForTimeout(2000).catch(() => {});
    if (await findClientFrame(3000)) return true;
  }
  return false;
}

async function startBot() {
  try {
    const currentPage = await ensureBrowser();
    botFrame = await findClientFrame(5000);
    if (!botFrame && currentPage.url().includes('lobby.tanoth.gameforge.com')) {
      await launchGameFromLobby();
      botFrame = await findClientFrame(90000);
    }
    if (!botFrame) {
      const location = currentPage.url();
      update({ mode: 'offline', message: `Keine aktive Spielsitzung gefunden (${location}) – npm run login erneut ausführen` });
      return;
    }
    await applyGameLocale(config.uiLocale);
    await botFrame.evaluate(({ source, botConfig, lastCombatReport }) => {
      window.__TANOTH_CONFIG__ = botConfig;
      window.__TANOTH_LAST_COMBAT_REPORT__ = lastCombatReport;
      window.__TANOTH_STOP__ = false;
      if (!window.__TANOTH_LOADED__) {
        window.__TANOTH_LOADED__ = true;
        (0, eval)(source);
      } else if (typeof window.runBot === 'function') {
        window.runBot();
      }
    }, { source: botSource, botConfig: config.bot || {}, lastCombatReport: state.reports?.combat || null });
    const directPlayerData = await botFrame.evaluate(async () => {
      if (typeof window.fetchTanothPlayerData !== 'function') return null;
      return window.fetchTanothPlayerData();
    }).catch(error => {
      log(`Spielerdaten konnten nicht direkt geladen werden: ${error.message}`);
      return null;
    });
    if (directPlayerData?.player) {
      const player = directPlayerData.player;
      const hasCoreData = [player.level, player.strength, player.dexterity, player.constitution, player.intelligence]
        .some(value => Number.isFinite(value));
      if (hasCoreData) {
        update({ player });
        if (player.inventoryOccupied === 0 && directPlayerData.diagnostics?.equipmentFields?.length) {
          log(`Inventardaten: ${directPlayerData.diagnostics.equipmentStructCount || 0} Einträge; Felder: ${directPlayerData.diagnostics.equipmentFields.join(', ')}`);
        }
      } else {
        const details = directPlayerData.diagnostics || {};
        const reason = details.fault || details.error
          ? `XML-RPC-Fehler: ${details.fault || details.error}`
          : `${details.memberCount || 0} Felder [${(details.fields || []).join(', ') || 'keine'}], ${details.responseLength || 0} Zeichen`;
        log(`Spielerdaten sind leer (${reason}). Automatischer Neuversuch läuft.`);
        if (details.error === 'no_valid_session') {
          update({ mode: 'offline', message: 'Browser-Sitzung abgelaufen – npm run login erneut ausführen' });
        } else {
          update({ message: 'Spielerdaten werden erneut abgerufen' });
        }
      }
    }
    const presentation = await botFrame.evaluate(() => {
      const images = [...document.images].filter(image => image.complete && image.naturalWidth >= 48 && image.naturalHeight >= 48);
      const preferred = images.find(image => /avatar|portrait|character|player|hero/i.test(`${image.id} ${image.className} ${image.alt}`));
      const image = preferred || images.sort((a, b) => (b.naturalHeight * b.naturalWidth) - (a.naturalHeight * a.naturalWidth))[0];
      const vars = globalThis.flashvars || {};
      return {
        image: image?.src || null,
        name: vars.characterName || vars.playerName || vars.username || null
      };
    }).catch(() => ({}));
    update({ player: presentation });
    if (state.mode !== 'offline') {
      update({ mode: state.mode === 'collecting' ? 'collecting' : 'online', message: state.mode === 'collecting' ? 'Bot läuft' : 'Bot wird initialisiert', startedAt: state.startedAt || new Date().toISOString() });
    }
  } catch (error) {
    log(error.stack || error.message);
    update({ mode: 'offline', message: error.message });
  }
}

async function stopBot() {
  if (page && !page.isClosed() && botFrame) {
    await botFrame.evaluate(() => { window.__TANOTH_STOP__ = true; }).catch(() => {});
  }
  update({ mode: 'deactivated', message: 'Bot wurde angehalten', startedAt: null });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 20000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Ungültiges JSON')); }
    });
    req.on('error', reject);
  });
}

async function saveBotSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ungültige Einstellungen');
  const keys = Object.keys(input);
  if (keys.some(key => !allowedBotSettings[key])) throw new Error('Unbekannte Einstellung');
  for (const [key, value] of Object.entries(input)) {
    if (!allowedBotSettings[key](value)) throw new Error(`Ungültiger Wert für ${key}`);
  }
  config.bot = { ...config.bot, ...input };
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  if (botFrame) {
    await botFrame.evaluate(settings => {
      if (typeof window.updateTanothConfig === 'function') window.updateTanothConfig(settings);
    }, config.bot).catch(() => {});
  }
  log('Bot-Einstellungen gespeichert');
  return config.bot;
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/status') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ ...state, logs: visibleLogs() }));
  }
  if (req.method === 'GET' && req.url === '/api/locale') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ locale: config.uiLocale, supported: supportedLocales }));
  }
  if (req.method === 'PUT' && req.url === '/api/locale') {
    try {
      const { locale } = await readJsonBody(req);
      if (!supportedLocales.includes(locale)) throw new Error('Unsupported locale');
      config.uiLocale = locale;
      fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
      await applyGameLocale(locale);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ locale }));
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: error.message }));
    }
  }
  if (req.method === 'GET' && req.url === '/api/settings') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify(config.bot));
  }
  if (req.method === 'PUT' && req.url === '/api/settings') {
    try {
      const settings = await saveBotSettings(await readJsonBody(req));
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(settings));
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: error.message }));
    }
  }
  if (req.method === 'POST' && req.url === '/api/start') {
    startBot();
    res.writeHead(202); return res.end();
  }
  if (req.method === 'POST' && req.url === '/api/stop') {
    await stopBot();
    res.writeHead(200); return res.end();
  }
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(indexHtml);
  }
  if (req.url === '/exadious-logo.png') {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' });
    return res.end(logoImage);
  }
  if (req.url === '/i18n.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(fs.readFileSync(path.join(root, 'public', 'i18n.js')));
  }
  const localeMatch = req.url.match(/^\/locales\/(de-DE|en-EN|fr-FR|es-ES)\.json$/);
  if (localeMatch) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(fs.readFileSync(path.join(localesPath, `${localeMatch[1]}.json`)));
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(config.dashboardPort, config.dashboardHost, () => {
  log(`Dashboard: http://${config.dashboardHost}:${config.dashboardPort}`);
  if (config.autoStart) startBot();
});

async function shutdown() {
  await stopBot();
  if (context) await context.close();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
