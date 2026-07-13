const path = require('node:path');
const fs = require('node:fs');
const readline = require('node:readline');
const { chromium } = require('playwright');

const root = __dirname;
const configPath = path.join(root, 'config.json');
const examplePath = path.join(root, 'config.example.json');
if (!fs.existsSync(configPath)) fs.copyFileSync(examplePath, configPath);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

(async () => {
  const context = await chromium.launchPersistentContext(path.join(root, '.browser-profile'), {
    headless: false,
    viewport: { width: 1280, height: 900 }
  });
  const page = context.pages()[0] || await context.newPage();
  await page.goto(config.serverUrl, { waitUntil: 'domcontentloaded' });
  console.log('\nBitte im geöffneten Fenster bei Tanoth anmelden.');
  console.log('In der Lobby einen Charakter auswählen und auf Spielen klicken.');
  console.log('Erst wenn der eigentliche Spiel-Client sichtbar ist, hier ENTER drücken.\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise(resolve => rl.question('', resolve));
  rl.close();
  let sessionFound = false;
  for (const currentPage of context.pages()) {
    for (const frame of currentPage.frames()) {
      try {
        sessionFound = await frame.evaluate(() => {
          const candidates = [globalThis.flashvars, globalThis.flashVars, globalThis.FLASHVARS];
          return candidates.some(item => item && (item.sessionID || item.sessionId));
        });
        if (sessionFound) break;
      } catch {}
    }
    if (sessionFound) break;
  }
  if (!sessionFound) {
    console.error('Keine aktive Spielsitzung erkannt. Bitte in der Lobby einen Charakter starten und den Login erneut ausführen.');
    await context.close();
    process.exitCode = 1;
    return;
  }
  await context.close();
  console.log('Sitzung wurde in .browser-profile gespeichert.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
