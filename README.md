# Exadiou's Tanoth Companion

Ein lokal laufender, headless Tanoth-Bot mit dauerhaft gespeicherter Browser-Sitzung, Web-Dashboard, Spielerinformationen, Reports und konfigurierbaren Automatisierungen.

> **Hinweis:** Dieses Projekt ist ein inoffizielles Community-Projekt und steht nicht in Verbindung mit Gameforge oder Tanoth. Die Nutzung erfolgt auf eigene Verantwortung. Prüfe vor der Verwendung die geltenden Spielregeln und Nutzungsbedingungen.

## Voraussetzungen

- Windows 10 oder Windows 11
- [Node.js](https://nodejs.org/) 18 oder neuer (empfohlen: aktuelle LTS-Version)
- npm (wird zusammen mit Node.js installiert)
- Ein Tanoth-Konto
- Internetzugang für die Installation und das Browserspiel

Versionen prüfen:

```powershell
node --version
npm --version
```

## Installation

Repository klonen und in den Projektordner wechseln:

```powershell
git clone https://github.com/Exadious/exadious-tanoth-companion.git
cd exadious-tanoth-companion
```

Abhängigkeiten und Chromium installieren:

```powershell
npm install
npx playwright install chromium
```

Beim ersten Start wird aus `config.example.json` automatisch eine lokale `config.json` erzeugt.

## Einmalige Anmeldung

Vor dem ersten Headless-Start muss einmal eine Browser-Sitzung angelegt werden:

```powershell
npm run login
```

1. Im geöffneten Chromium-Fenster bei Tanoth anmelden.
2. Den gewünschten Server und Charakter öffnen.
3. Warten, bis der Spielclient vollständig geladen ist.
4. Im Terminal `Enter` drücken.

Die Sitzung wird ausschließlich lokal im Ordner `.browser-profile/` gespeichert. Zugangsdaten werden nicht in der Bot-Konfiguration hinterlegt.

## Bot starten

```powershell
npm start
```

Anschließend das Dashboard im Browser öffnen:

<http://127.0.0.1:3210>

Über das Dashboard lassen sich der Bot starten und stoppen, Einstellungen anpassen sowie Spielerinformationen, Tagesstatistiken, Begleiter, Ausrüstung, Inventar und Reports anzeigen.

Das Terminal muss während des Betriebs geöffnet bleiben. Beenden kannst du den Server mit `Strg+C`.

## Verfügbare Befehle

| Befehl | Beschreibung |
| --- | --- |
| `npm run login` | Öffnet Chromium für die manuelle Anmeldung und speichert die Sitzung lokal |
| `npm start` | Startet Server, Dashboard und den Headless-Browser |
| `npm run check` | Prüft die JavaScript-Dateien auf Syntaxfehler |

## Konfiguration

Die lokale Konfiguration befindet sich in `config.json`. Viele Einstellungen können direkt über das Dashboard geändert werden.

Wichtige Basisoptionen:

| Einstellung | Bedeutung |
| --- | --- |
| `serverUrl` | URL des gewünschten Tanoth-Servers |
| `dashboardHost` | Lokale Adresse des Dashboards |
| `dashboardPort` | Port des Dashboards, standardmäßig `3210` |
| `autoStart` | Startet den Bot automatisch zusammen mit dem Server |
| `uiLocale` | Sprache von Oberfläche und Spielclient |

Der Bot unterstützt unter anderem Abenteuerpriorität, Schwierigkeitswahl, Gold- und Blutsteinreserven, Attribut- oder Kreisverbesserungen, PvP, Dungeon, automatisches Ausrüsten und den Verkauf von Inventargegenständen.

## Unterstützte Sprachen

- Englisch (`en-EN`, Standard)
- Deutsch (`de-DE`)
- Französisch (`fr-FR`)
- Spanisch (`es-ES`)

Die Sprache kann im Dashboard neben den Start-/Stopp-Schaltflächen gewählt werden. Sie steuert zugleich die Sprache des Spielclients.

## Sitzung abgelaufen

Falls das Dashboard eine abgelaufene Browser-Sitzung meldet:

1. Server mit `Strg+C` beenden.
2. `npm run login` erneut ausführen.
3. Anmeldung abschließen und danach `npm start` ausführen.

## Datenschutz und GitHub

Persönliche Laufzeitdaten sind über `.gitignore` vom Repository ausgeschlossen:

- `.browser-profile/` – Browser-Sitzung und Cookies
- `config.json` und `.env*` – lokale Konfiguration und Umgebungsvariablen
- `.player-cache.json` – Spielerinformationen
- `.daily-stats.json` – lokale Tagesstatistik
- `.reports.json` – Kampf- und Spielreports
- `*.log` – lokale Server- und Fehlerprotokolle
- `node_modules/` – installierte Abhängigkeiten

Diese Dateien dürfen nicht manuell zu Git hinzugefügt oder veröffentlicht werden. Für neue Installationen ist ausschließlich `config.example.json` als Vorlage vorgesehen.

Vor einem Commit kann der Ausschluss mit folgendem Befehl kontrolliert werden:

```powershell
git status --short --ignored
```

Ignorierte sensible Dateien erscheinen dabei mit `!!`.

## Fehlerbehebung

### Dashboard ist nicht erreichbar

- Prüfen, ob `npm start` noch läuft.
- Prüfen, ob Port `3210` bereits von einem anderen Programm verwendet wird.
- Den in `config.json` eingestellten Port öffnen.

### Chromium startet nicht

```powershell
npx playwright install chromium
```

### Spielerdaten bleiben leer

- Die Browser-Sitzung mit `npm run login` erneuern.
- Sicherstellen, dass der Charakter vollständig geladen wurde.
- Server anschließend neu starten.

## Lizenz

Vor einer öffentlichen Veröffentlichung sollte eine passende Lizenzdatei ergänzt werden. Ohne ausdrückliche Lizenz bleiben alle Rechte beim Urheber.
