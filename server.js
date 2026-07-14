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
const discordNotificationBooleanKeys = new Set([
  'botLifecycle', 'sessionWarnings', 'errors', 'adventures', 'pvp', 'dungeons', 'work',
  'levelUp', 'potionExpired', 'mountChanged', 'bloodstonesSpent', 'resourceWarnings',
  'inventoryWarnings', 'itemsSold', 'equipmentPlayer', 'equipmentCompanions',
  'guildDonations', 'guildUpgrades', 'guildMembers', 'quietHoursEnabled'
]);
const defaultDiscordNotifications = {
  botLifecycle: false, sessionWarnings: false, errors: false,
  adventures: false, pvp: false, dungeons: false, work: false,
  levelUp: false, potionExpired: false, mountChanged: false, bloodstonesSpent: false,
  resourceWarnings: false, inventoryWarnings: false, itemsSold: false,
  equipmentPlayer: false, equipmentCompanions: false,
  guildDonations: false, guildUpgrades: false, guildMembers: false,
  lowGoldThreshold: 0, lowBloodstonesThreshold: 0, inventoryWarningPercent: 90,
  quietHoursEnabled: false, quietHoursStart: 22, quietHoursEnd: 7
};
function isDiscordNotifications(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, setting]) => {
    if (discordNotificationBooleanKeys.has(key)) return typeof setting === 'boolean';
    if (['lowGoldThreshold', 'lowBloodstonesThreshold'].includes(key)) return Number.isInteger(setting) && setting >= 0;
    if (key === 'inventoryWarningPercent') return Number.isInteger(setting) && setting >= 1 && setting <= 100;
    if (['quietHoursStart', 'quietHoursEnd'].includes(key)) return Number.isInteger(setting) && setting >= 0 && setting <= 23;
    return false;
  });
}
if (!supportedLocales.includes(config.uiLocale)) config.uiLocale = 'en-EN';
config.bot.discordNotifications = { ...defaultDiscordNotifications, ...(config.bot.discordNotifications || {}) };
let cachedPlayer = {};
try { cachedPlayer = JSON.parse(fs.readFileSync(playerCachePath, 'utf8')); } catch {}
const currentDayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const emptyDailyStats = () => ({
  goldCollected: 0, goldSpent: 0, experienceGained: 0, adventuresCompleted: 0,
  freeAdventures: 0, bloodstoneAdventures: 0, bloodstonesSpent: 0,
  attributesBought: 0, attributeStrength: 0, attributeDexterity: 0,
  attributeConstitution: 0, attributeIntelligence: 0, circleItemsBought: 0,
  pvpWins: 0, pvpLosses: 0, fameGained: 0, fameLost: 0,
  dungeonWins: 0, dungeonLosses: 0, freeDungeonAttempts: 0, bloodstoneDungeonAttempts: 0,
  workSessions: 0, workHours: 0, workGold: 0,
  itemsSold: 0, saleGold: 0, playerItemsEquipped: 0, companionItemsEquipped: 0,
  guildGoldDonated: 0, guildUpgradeGoldSpent: 0, guildUpgradesBought: 0,
  pauses: 0, pauseDurationMs: 0, sessionDisconnects: 0, reconnections: 0,
  successfulActions: 0, lastSuccessfulAction: '', errors: 0, runtimeMs: 0
});
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
  autoEquipPlayerPriorities: value => Array.isArray(value) && value.every(attribute => ['STR', 'DEX', 'CON', 'INT'].includes(attribute)),
  autoEquipPlayerMaxMalus: value => Number.isInteger(value) && value >= 0,
  autoEquipCompanionPriorities: value => Array.isArray(value) && value.every(attribute => ['STR', 'DEX', 'CON', 'INT'].includes(attribute)),
  autoEquipCompanionMaxMalus: value => Number.isInteger(value) && value >= 0,
  autoEquipCompanionProfiles: value => value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([id, profile]) => /^\d+$/.test(id) && profile && Array.isArray(profile.priorities) && profile.priorities.every(attribute => ['STR', 'DEX', 'CON', 'INT'].includes(attribute)) && Number.isInteger(profile.maxMalus) && profile.maxMalus >= 0),
  enablePvp: value => typeof value === 'boolean',
  pvpLimitType: value => ['rank', 'level', 'both'].includes(value),
  pvpMaxRankDifference: value => Number.isInteger(value) && value >= 0,
  pvpMaxLevelDifference: value => Number.isInteger(value) && value >= 0,
  pvpOpponentLevelBelow: value => Number.isInteger(value) && value >= 1,
  enableDungeon: value => typeof value === 'boolean',
  dungeonUseBloodstones: value => typeof value === 'boolean',
  dungeonMinBloodstones: value => Number.isInteger(value) && value >= 0,
  enableWork: value => typeof value === 'boolean',
  workHours: value => Number.isInteger(value) && value >= 1 && value <= 8,
  autoSell: value => typeof value === 'boolean',
  autoSellRarity: value => ['common', 'non_unique', 'all'].includes(value),
  autoSellMinValue: value => Number.isInteger(value) && value >= 0,
  autoSellKeepAttributes: value => Array.isArray(value) && value.every(attribute => ['STR', 'DEX', 'CON', 'INT'].includes(attribute)),
  discordDailyStatsEnabled: value => typeof value === 'boolean',
  discordWebhookUrl: value => typeof value === 'string' && (value === '' || isDiscordWebhookUrl(value)),
  discordNotifications: isDiscordNotifications,
  guildAutoDonateGold: value => typeof value === 'boolean',
  guildDonationAmount: value => Number.isInteger(value) && value >= 0,
  guildMinPlayerGold: value => Number.isInteger(value) && value >= 0,
  guildDonationDailyLimit: value => Number.isInteger(value) && value >= 0,
  guildAutoUpgrade: value => typeof value === 'boolean',
  guildUpgradePriorities: value => Array.isArray(value) && value.length <= 5 && new Set(value).size === value.length && value.every(feature => ['fort', 'treasury', 'wall', 'banner', 'watchtower'].includes(feature)),
  guildUpgradeDailyGoldLimit: value => Number.isInteger(value) && value >= 0
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
let discordSendChain = Promise.resolve();
const discordNotificationDedup = new Map();

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
  const previousMode = state.mode;
  const previous = {
    mode: state.mode, message: state.message, gold: state.gold, bloodstones: state.bloodstones,
    player: state.player, reports: state.reports
  };
  const statsEvent = patch.statsEvent ? { ...patch.statsEvent } : null;
  if (dailyStore.date !== currentDayKey()) {
    dailyStore = { date: currentDayKey(), stats: emptyDailyStats(), samples: { gold: null, bloodstones: null, experience: null, adventures: null } };
    state.dailyStats = dailyStore.stats;
    Object.assign(statBaseline, dailyStore.samples);
  }
  if (state.mode === 'collecting') state.dailyStats.runtimeMs += Math.max(0, now - lastStatsTick);
  lastStatsTick = now;
  if (patch.statsEvent) {
    for (const [key, amount] of Object.entries(patch.statsEvent)) {
      if (!(key in state.dailyStats)) continue;
      if (key === 'lastSuccessfulAction' && typeof amount === 'string') state.dailyStats[key] = amount;
      else if (Number.isFinite(amount)) state.dailyStats[key] += amount;
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
  if (patch.mode === 'offline' && ['online', 'collecting'].includes(previousMode)) state.dailyStats.sessionDisconnects += 1;
  if (['online', 'collecting'].includes(patch.mode) && previousMode === 'offline') state.dailyStats.reconnections += 1;
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
  detectDiscordNotifications(previous, state, { ...patch, statsEvent });
}

function log(message) {
  const line = `${new Date().toLocaleTimeString('de-DE')} ${message}`;
  state.logs.unshift(line);
  state.logs = state.logs.slice(0, 80);
  console.log(line);
  if (/\b(error|fehler|exception|failed)\b/i.test(message) && !/no_valid_session/i.test(message)) state.dailyStats.errors += 1;
  dailyStore.stats = state.dailyStats;
  fs.writeFileSync(dailyStatsPath, `${JSON.stringify(dailyStore, null, 2)}\n`, 'utf8');
  if (/\b(error|fehler|exception|failed)\b/i.test(message) && !/Discord-|no_valid_session/i.test(message)) {
    queueDiscordNotification({ key: 'errors', category: 'System', title: 'Bot-Fehler', description: message, color: 0xe6a23c, critical: true });
  }
}

setInterval(() => {
  const now = Date.now();
  if (state.mode === 'collecting') state.dailyStats.runtimeMs += Math.max(0, now - lastStatsTick);
  lastStatsTick = now;
  dailyStore.stats = state.dailyStats;
  dailyStore.samples = statBaseline;
  fs.writeFileSync(dailyStatsPath, `${JSON.stringify(dailyStore, null, 2)}\n`, 'utf8');
}, 5000);

function isDiscordWebhookUrl(value) {
  try {
    const url = new URL(value);
    const allowedHosts = new Set(['discord.com', 'discordapp.com', 'canary.discord.com', 'ptb.discord.com']);
    return url.protocol === 'https:' && allowedHosts.has(url.hostname) && /^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+$/.test(url.pathname);
  } catch {
    return false;
  }
}

function discordSetting(key) {
  return Boolean(config.bot.discordNotifications?.[key]);
}

function isDiscordQuietTime() {
  const settings = config.bot.discordNotifications || defaultDiscordNotifications;
  if (!settings.quietHoursEnabled) return false;
  const hour = new Date().getHours();
  const start = Number(settings.quietHoursStart);
  const end = Number(settings.quietHoursEnd);
  return start === end ? true : start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function queueDiscordNotification(event) {
  const webhookUrl = String(config.bot.discordWebhookUrl || '').trim();
  if (!event?.key || !discordSetting(event.key) || !isDiscordWebhookUrl(webhookUrl)) return;
  if (!event.critical && isDiscordQuietTime()) return;
  const signature = `${event.key}:${event.signature || event.title}:${event.description || ''}`;
  const now = Date.now();
  if (now - (discordNotificationDedup.get(signature) || 0) < 30000) return;
  discordNotificationDedup.set(signature, now);
  const payload = {
    username: "Exadious Tanoth Companion",
    embeds: [{
      author: { name: event.category || 'Bot' },
      title: event.title,
      description: event.description || undefined,
      color: event.color || 0xb52f41,
      fields: (event.fields || []).map(field => ({ name: field.name, value: String(field.value), inline: Boolean(field.inline) })),
      footer: { text: state.player?.name || 'Tanoth Companion' },
      timestamp: new Date().toISOString()
    }]
  };
  discordSendChain = discordSendChain.then(async () => {
    const response = await fetch(webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    log(`Discord-Benachrichtigung gesendet: ${event.category || 'Bot'} – ${event.title}`);
  }).catch(error => console.error(`Discord-Ereignis konnte nicht gesendet werden: ${error.message}`));
}

const discordField = (name, value, inline = true) => ({ name, value: value ?? '–', inline });
const reportSignature = report => report?.timestamp || JSON.stringify(report || null);
const potionNames = player => new Set((Array.isArray(player?.potions) ? player.potions : []).map(potion => potion?.name).filter(Boolean));
const guildMemberNames = player => new Set((Array.isArray(player?.guildDetails?.members) ? player.guildDetails.members : []).map(member => member?.name).filter(Boolean));

function detectDiscordNotifications(previous, current, patch) {
  const previousPlayer = previous.player || {};
  const player = current.player || {};
  const event = patch.statsEvent || {};
  if (previous.mode !== current.mode) {
    if (current.mode === 'deactivated') queueDiscordNotification({ key: 'botLifecycle', category: 'System', title: 'Bot gestoppt', description: current.message, color: 0x8b949e });
    else if (current.mode === 'collecting' && previous.mode !== 'collecting') queueDiscordNotification({ key: 'botLifecycle', category: 'System', title: 'Bot gestartet', description: 'Die Automatisierung ist aktiv.', color: 0x43b581 });
    else if (current.mode === 'offline') queueDiscordNotification({ key: 'sessionWarnings', category: 'System', title: 'Verbindung oder Sitzung unterbrochen', description: current.message, color: 0xed4245, critical: true });
    else if (previous.mode === 'offline' && ['online', 'collecting'].includes(current.mode)) queueDiscordNotification({ key: 'sessionWarnings', category: 'System', title: 'Verbindung wiederhergestellt', description: current.message, color: 0x43b581, critical: true });
  }
  if (current.mode === 'offline' && previous.message !== current.message && /Sitzung abgelaufen/i.test(current.message || '')) {
    queueDiscordNotification({ key: 'sessionWarnings', category: 'System', title: 'Browser-Sitzung abgelaufen', description: current.message, color: 0xed4245, critical: true });
  }
  if (Number.isFinite(previousPlayer.level) && Number(player.level) > Number(previousPlayer.level)) {
    queueDiscordNotification({ key: 'levelUp', category: 'Spieler', title: `Level ${player.level} erreicht`, description: `${player.name || 'Der Spieler'} ist aufgestiegen.`, color: 0xf1c40f });
  }
  if (previousPlayer.mount && player.mount && previousPlayer.mount !== player.mount) {
    queueDiscordNotification({ key: 'mountChanged', category: 'Spieler', title: 'Reittier gewechselt', fields: [discordField('Vorher', previousPlayer.mount), discordField('Jetzt', player.mount)], color: 0x9b59b6 });
  }
  const oldPotions = potionNames(previousPlayer);
  const newPotions = potionNames(player);
  for (const potion of oldPotions) if (!newPotions.has(potion)) queueDiscordNotification({ key: 'potionExpired', category: 'Spieler', title: 'Trank abgelaufen', description: potion, signature: potion, color: 0x9b59b6 });

  const oldInventoryPercent = Number(previousPlayer.inventorySlots) > 0 ? Number(previousPlayer.inventoryOccupied) / Number(previousPlayer.inventorySlots) * 100 : 0;
  const inventoryPercent = Number(player.inventorySlots) > 0 ? Number(player.inventoryOccupied) / Number(player.inventorySlots) * 100 : 0;
  const warningPercent = Number(config.bot.discordNotifications?.inventoryWarningPercent || 90);
  if (inventoryPercent >= warningPercent && oldInventoryPercent < warningPercent) {
    queueDiscordNotification({ key: 'inventoryWarnings', category: 'Ausrüstung & Inventar', title: inventoryPercent >= 100 ? 'Inventar vollständig belegt' : 'Inventar wird knapp', description: `${player.inventoryOccupied} / ${player.inventorySlots} Plätze belegt (${Math.round(inventoryPercent)} %).`, color: inventoryPercent >= 100 ? 0xed4245 : 0xe6a23c });
  }
  const goldThreshold = Number(config.bot.discordNotifications?.lowGoldThreshold || 0);
  const bloodstoneThreshold = Number(config.bot.discordNotifications?.lowBloodstonesThreshold || 0);
  if (goldThreshold > 0 && Number.isFinite(previous.gold) && previous.gold >= goldThreshold && current.gold < goldThreshold) queueDiscordNotification({ key: 'resourceWarnings', category: 'Ressourcen', title: 'Goldreserve unterschritten', description: `${formatInteger(current.gold)} Gold verbleiben.`, color: 0xe6a23c });
  if (bloodstoneThreshold > 0 && Number.isFinite(previous.bloodstones) && previous.bloodstones >= bloodstoneThreshold && current.bloodstones < bloodstoneThreshold) queueDiscordNotification({ key: 'resourceWarnings', category: 'Ressourcen', title: 'Blutsteinreserve unterschritten', description: `${formatInteger(current.bloodstones)} Blutsteine verbleiben.`, color: 0xe6a23c });
  if (Number.isFinite(previous.bloodstones) && Number(current.bloodstones) < Number(previous.bloodstones)) queueDiscordNotification({ key: 'bloodstonesSpent', category: 'Ressourcen', title: 'Blutsteine ausgegeben', fields: [discordField('Ausgegeben', previous.bloodstones - current.bloodstones), discordField('Verbleibend', current.bloodstones)], color: 0xc039d3 });

  const reportEvents = [
    ['combat', 'pvp', 'Kampf', 'PvP-Kampf abgeschlossen'],
    ['adventure', 'adventures', 'Abenteuer', 'Abenteuer abgeschlossen'],
    ['dungeon', 'dungeons', 'Dungeon', 'Dungeonkampf abgeschlossen']
  ];
  for (const [reportKey, settingKey, category, title] of reportEvents) {
    const report = current.reports?.[reportKey];
    if (!report || reportSignature(report) === reportSignature(previous.reports?.[reportKey])) continue;
    const fields = reportKey === 'adventure'
      ? [discordField('Gold', `+${formatInteger(report.goldGained)}`), discordField('Erfahrung', `+${formatInteger(report.experienceGained)}`), discordField('Blutsteine', `−${formatInteger(report.bloodstonesSpent)}`)]
      : [discordField('Gegner', report.opponentName || 'Unbekannt'), discordField('Level', report.opponentLevel ?? report.dungeonLevel ?? '–'), discordField('Ergebnis', report.victory ? 'Sieg' : 'Niederlage'), discordField('Gold', `${Number(report.goldChange) >= 0 ? '+' : ''}${formatInteger(report.goldChange)}`), discordField('Erfahrung', `${Number(report.experienceChange) >= 0 ? '+' : ''}${formatInteger(report.experienceChange)}`)];
    queueDiscordNotification({ key: settingKey, category, title, fields, signature: reportSignature(report), color: report.victory === false ? 0xed4245 : 0x43b581 });
  }
  if (event.workSessions > 0) queueDiscordNotification({ key: 'work', category: 'Arbeit', title: 'Arbeit begonnen', description: `${formatInteger(event.workHours)} Stunde(n), Ende ${player.taskEndAt ? new Date(player.taskEndAt).toLocaleTimeString('de-DE') : 'unbekannt'}.`, color: 0x3498db });
  if (event.workGold > 0) queueDiscordNotification({ key: 'work', category: 'Arbeit', title: 'Arbeit abgeschlossen', description: `+${formatInteger(event.workGold)} Gold`, color: 0x43b581 });
  if (event.itemsSold > 0) queueDiscordNotification({ key: 'itemsSold', category: 'Ausrüstung & Inventar', title: 'Gegenstand verkauft', description: `+${formatInteger(event.saleGold)} Gold`, color: 0x43b581 });
  if (event.playerItemsEquipped > 0) queueDiscordNotification({ key: 'equipmentPlayer', category: 'Ausrüstung & Inventar', title: 'Spielerausrüstung verbessert', description: event.lastSuccessfulAction || 'Ein besserer Gegenstand wurde ausgerüstet.', color: 0x3498db });
  if (event.companionItemsEquipped > 0) queueDiscordNotification({ key: 'equipmentCompanions', category: 'Ausrüstung & Inventar', title: 'Begleiterausrüstung verbessert', description: event.lastSuccessfulAction || 'Ein besserer Gegenstand wurde ausgerüstet.', color: 0x3498db });
  if (event.guildGoldDonated > 0) queueDiscordNotification({ key: 'guildDonations', category: 'Gilde', title: 'Gold gespendet', description: `${formatInteger(event.guildGoldDonated)} Gold wurden an ${player.guild || 'die Gilde'} gespendet.`, color: 0xf1c40f });
  if (event.guildUpgradesBought > 0) queueDiscordNotification({ key: 'guildUpgrades', category: 'Gilde', title: 'Gildenausbau verbessert', description: `${event.lastSuccessfulAction || 'Ein Gebäude wurde verbessert.'} (−${formatInteger(event.guildUpgradeGoldSpent)} Gold)`, color: 0xf1c40f });

  if (previousPlayer.guildDetails && player.guildDetails) {
    const oldMembers = guildMemberNames(previousPlayer);
    const members = guildMemberNames(player);
    for (const name of members) if (!oldMembers.has(name)) queueDiscordNotification({ key: 'guildMembers', category: 'Gilde', title: 'Mitglied beigetreten', description: name, signature: `joined:${name}`, color: 0x43b581 });
    for (const name of oldMembers) if (!members.has(name)) queueDiscordNotification({ key: 'guildMembers', category: 'Gilde', title: 'Mitglied ausgetreten', description: name, signature: `left:${name}`, color: 0xed4245 });
  }
}

const formatInteger = value => new Intl.NumberFormat('de-DE').format(Number(value) || 0);
const formatDuration = milliseconds => {
  const totalMinutes = Math.max(0, Math.round((Number(milliseconds) || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} Std. ${minutes} Min.`;
};

function buildDiscordDailyStatsPayload(test = false) {
  const stats = state.dailyStats || emptyDailyStats();
  const pvpTotal = Number(stats.pvpWins || 0) + Number(stats.pvpLosses || 0);
  const netGold = Number(stats.goldCollected || 0) - Number(stats.goldSpent || 0);
  const pvpRate = pvpTotal ? Math.round(Number(stats.pvpWins || 0) / pvpTotal * 100) : 0;
  const signed = value => `${Number(value) >= 0 ? '+' : '−'}${formatInteger(Math.abs(Number(value) || 0))}`;
  const block = lines => `\`\`\`\n${lines.join('\n')}\n\`\`\``;
  const field = (name, lines) => ({ name, value: block(lines), inline: false });
  return {
    username: "Exadious Tanoth Companion",
    embeds: [{
      title: test ? '🧪 Test der Tagesstatistik' : '📊 Tagesstatistik des Bots',
      description: `**${state.player?.name || 'Tanoth-Spieler'}** · Stand ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`,
      color: 0xb52f41,
      fields: [
        field('💰 Bilanz', [
          `Einnahmen   +${formatInteger(stats.goldCollected)} Gold`,
          `Ausgaben    −${formatInteger(stats.goldSpent)} Gold`,
          `Netto       ${signed(netGold)} Gold`,
          `Erfahrung   +${formatInteger(stats.experienceGained)} EP`,
          `Blutsteine  −${formatInteger(stats.bloodstonesSpent)}`
        ]),
        field('⚔️ Abenteuer & Kämpfe', [
          `Abenteuer   ${formatInteger(stats.adventuresCompleted)} gesamt | ${formatInteger(stats.freeAdventures)} frei | ${formatInteger(stats.bloodstoneAdventures)} BS`,
          `PvP         ${formatInteger(stats.pvpWins)} Siege | ${formatInteger(stats.pvpLosses)} Niederl. | ${pvpRate} %`,
          `Dungeon     ${formatInteger(stats.dungeonWins)} Siege | ${formatInteger(stats.dungeonLosses)} Niederl.`,
          `Ruhm        +${formatInteger(stats.fameGained)} | −${formatInteger(stats.fameLost)}`
        ]),
        field('🛠️ Arbeit & Verkauf', [
          `Arbeit      ${formatInteger(stats.workSessions)} Einsätze | ${formatInteger(stats.workHours)} Std. | +${formatInteger(stats.workGold)} Gold`,
          `Verkauf     ${formatInteger(stats.itemsSold)} Items | +${formatInteger(stats.saleGold)} Gold`
        ]),
        field('📈 Verbesserungen', [
          `Attribute   ${formatInteger(stats.attributesBought)} | STR ${formatInteger(stats.attributeStrength)} | GES ${formatInteger(stats.attributeDexterity)}`,
          `            KON ${formatInteger(stats.attributeConstitution)} | INT ${formatInteger(stats.attributeIntelligence)}`,
          `Kreis       ${formatInteger(stats.circleItemsBought)} Gegenstände`,
          `Ausrüstung  ${formatInteger(stats.playerItemsEquipped)} Spieler | ${formatInteger(stats.companionItemsEquipped)} Begleiter`
        ]),
        field('⚙️ Botbetrieb', [
          `Laufzeit    ${formatDuration(stats.runtimeMs)}`,
          `Pausen      ${formatInteger(stats.pauses)} | ${formatDuration(stats.pauseDurationMs)}`,
          `Aktionen    ${formatInteger(stats.successfulActions)}`,
          `Fehler      ${formatInteger(stats.errors)}`
        ]),
        { name: '✅ Letzte erfolgreiche Aktion', value: `> ${stats.lastSuccessfulAction || 'Keine'}`, inline: false }
      ],
      footer: { text: `${currentDayKey()} · Täglicher Versand um 12:00 Uhr` },
      timestamp: new Date().toISOString()
    }]
  };
}

async function sendDiscordDailyStats({ test = false } = {}) {
  const webhookUrl = String(config.bot.discordWebhookUrl || '').trim();
  if (!isDiscordWebhookUrl(webhookUrl)) throw new Error('Keine gültige Discord-Webhook-URL konfiguriert');
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildDiscordDailyStatsPayload(test))
  });
  if (!response.ok) throw new Error(`Discord antwortete mit HTTP ${response.status}`);
  log(test ? 'Discord-Teststatistik wurde gesendet' : 'Discord-Tagesstatistik wurde gesendet');
}

let discordDailyStatsTimer;
function scheduleDiscordDailyStats() {
  clearTimeout(discordDailyStatsTimer);
  const now = new Date();
  const next = new Date(now);
  next.setHours(12, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  discordDailyStatsTimer = setTimeout(async () => {
    try {
      if (config.bot.discordDailyStatsEnabled) await sendDiscordDailyStats();
    } catch (error) {
      log(`Discord-Tagesstatistik fehlgeschlagen: ${error.message}`);
    } finally {
      scheduleDiscordDailyStats();
    }
  }, Math.max(1000, next.getTime() - now.getTime()));
}

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
  await context.exposeFunction('__tanothGetDailyStats', () => ({ ...state.dailyStats }));
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
  const nextBotConfig = { ...config.bot, ...input };
  if (nextBotConfig.discordDailyStatsEnabled && !isDiscordWebhookUrl(nextBotConfig.discordWebhookUrl)) {
    throw new Error('Für den Discord-Versand wird eine gültige Webhook-URL benötigt');
  }
  config.bot = nextBotConfig;
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
  if (req.method === 'POST' && req.url === '/api/sell-inventory') {
    try {
      if (!botFrame) throw new Error('Bot und Spielsitzung müssen aktiv sein');
      const result = await botFrame.evaluate(async () => {
        if (typeof window.sellAllInventoryItems !== 'function') throw new Error('Verkaufsroutine ist nicht geladen');
        return window.sellAllInventoryItems();
      });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: error.message }));
    }
  }
  if (req.method === 'POST' && req.url === '/api/discord/test') {
    try {
      await sendDiscordDailyStats({ test: true });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ sent: true }));
    } catch (error) {
      res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: error.message }));
    }
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
  scheduleDiscordDailyStats();
  if (config.autoStart) startBot();
});

async function shutdown() {
  clearTimeout(discordDailyStatsTimer);
  await stopBot();
  if (context) await context.close();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
