# ⚔️ Exadiou's Tanoth Companion

A locally hosted, headless Tanoth companion featuring a persistent browser session, a web dashboard, player information, reports, and configurable automation.

> [!WARNING]
> This is an unofficial community project and is not affiliated with Gameforge or Tanoth. Use it at your own risk and review the applicable game rules and terms of service before using it.

## ✨ Features

- Headless Chromium with a reusable local login session
- Local web dashboard for starting, stopping, and configuring the bot
- Player, companion, equipment, inventory, and mount information
- Daily statistics and activity reports
- Adventure, PvP, dungeon, equipment, and inventory automation
- English, German, French, and Spanish interface support

## 📋 Requirements

- Windows 10 or Windows 11
- [Node.js](https://nodejs.org/) 18 or newer (the current LTS version is recommended)
- npm, which is included with Node.js
- A Tanoth account
- An internet connection for installation and gameplay

Verify your installed versions:

```powershell
node --version
npm --version
```

## 📦 Installation

Clone the repository and enter the project directory:

```powershell
git clone https://github.com/Exadious/exadious-tanoth-companion.git
cd exadious-tanoth-companion
```

Install the dependencies and Chromium:

```powershell
npm install
npx playwright install chromium
```

On the first start, the application automatically creates a local `config.json` from `config.example.json`.

## 🔐 First-time login

Before running the bot headlessly, create a browser session once:

```powershell
npm run login
```

1. Sign in to Tanoth in the Chromium window that opens.
2. Open your preferred server and character.
3. Wait until the game client has fully loaded.
4. Return to the terminal and press `Enter`.

The session is stored only on your computer in `.browser-profile/`. Login credentials are not stored in the bot configuration.

## 🚀 Starting the bot

```powershell
npm start
```

Open the dashboard in your browser:

<http://127.0.0.1:3210>

The dashboard lets you start and stop the bot, change its settings, and view player information, daily statistics, companions, equipment, inventory, and reports.

Keep the terminal open while the bot is running. Press `Ctrl+C` in the terminal to stop the server.

## 🧰 Available commands

| Command | Description |
| --- | --- |
| `npm run login` | Opens Chromium for manual login and stores the browser session locally |
| `npm start` | Starts the server, dashboard, and headless browser |
| `npm run check` | Checks the JavaScript files for syntax errors |

## ⚙️ Configuration

Local settings are stored in `config.json`. Most bot settings can also be changed directly from the dashboard.

Important base options:

| Setting | Description |
| --- | --- |
| `serverUrl` | URL of the Tanoth server to use |
| `dashboardHost` | Local address used by the dashboard |
| `dashboardPort` | Dashboard port; defaults to `3210` |
| `autoStart` | Starts the bot automatically when the server starts |
| `uiLocale` | Controls both the dashboard and game-client language |

Automation options include adventure priority, difficulty, gold and bloodstone reserves, attribute or circle upgrades, PvP, dungeon battles, automatic equipment upgrades, and selling inventory items.

## 🌍 Supported languages

- 🇬🇧 English (`en-EN`, default)
- 🇩🇪 German (`de-DE`)
- 🇫🇷 French (`fr-FR`)
- 🇪🇸 Spanish (`es-ES`)

Select the language from the dashboard next to the Start and Stop buttons. The selected UI language also controls the game-client language.

## 🔄 Expired browser session

If the dashboard reports that the browser session has expired:

1. Stop the server with `Ctrl+C`.
2. Run `npm run login` again.
3. Complete the login process, then run `npm start`.

## 🛡️ Privacy and GitHub safety

Personal runtime data is excluded from Git through `.gitignore`:

- `.browser-profile/` — browser session and cookies
- `config.json` and `.env*` — local configuration and environment variables
- `.player-cache.json` — cached player information
- `.daily-stats.json` — local daily statistics
- `.reports.json` — combat and activity reports
- `*.log` — local server and error logs
- `node_modules/` — installed dependencies

Do not force-add or publish these files. New installations should use only `config.example.json` as their configuration template.

You can verify ignored files before committing:

```powershell
git status --short --ignored
```

Sensitive ignored files are shown with the `!!` prefix.

## 🩹 Troubleshooting

### The dashboard is unavailable

- Make sure `npm start` is still running.
- Check whether another application is already using port `3210`.
- Open the port configured in your local `config.json`.

### Chromium does not start

Install or repair the bundled browser:

```powershell
npx playwright install chromium
```

### Player data remains empty

- Refresh the browser session with `npm run login`.
- Make sure the character has fully loaded before saving the session.
- Restart the server afterward.

## 📜 License

No license has been granted yet. Unless a license file is added, all rights remain with the copyright holder.
