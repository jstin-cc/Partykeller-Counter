# Getränke-Counter Partykeller 🍺

Gäste zählen ihre Biere und Shots über das Handy, ein Fernseher zeigt die
dauerhafte All-Time-Rangliste. Läuft komplett im lokalen WLAN auf einem
Raspberry Pi — keine Internet-Abhängigkeit.

**Status:** Funktional komplett (M0–M7) — Login, Nutzer-Dashboard,
TV-Scoreboard mit QR-Code und Admin-Bereich laufen live über WebSocket.
Offene Restpunkte in [PROGRESS.md](PROGRESS.md).

## Voraussetzungen

- **Node.js 20 LTS oder neuer** (aktuelles LTS empfohlen). `better-sqlite3`
  bringt dafür fertige Binaries mit — es muss nichts kompiliert werden, keine
  Visual-Studio-Build-Tools nötig.
- **Git**.

## Erste Einrichtung

**macOS/Linux (bash):**

```bash
git clone https://github.com/jstin-cc/Partykeller-Counter.git
cd Partykeller-Counter
npm install
cp .env.example .env          # ADMIN_PASSWORD und TOKEN_SECRET setzen
npm run seed                  # optional: Testnutzer (PIN 1111)
npm start                     # http://localhost:3000
```

**Windows (PowerShell):**

```powershell
git clone https://github.com/jstin-cc/Partykeller-Counter.git
cd Partykeller-Counter
npm install
Copy-Item .env.example .env   # ADMIN_PASSWORD und TOKEN_SECRET setzen
npm run seed                  # optional: Testnutzer (PIN 1111)
npm start                     # http://localhost:3000
```

> Die `.env` muss `ADMIN_PASSWORD` und `TOKEN_SECRET` enthalten (Vorlage:
> `.env.example`), sonst startet der Server bewusst nicht. Ein sicheres
> `TOKEN_SECRET` erzeugst du z. B. mit
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## Auf neue Version aktualisieren / Neustart

Laufenden Server im Terminal stoppen (**Strg + C**), dann ins Projektverzeichnis
wechseln und aktualisieren.

**Windows (PowerShell):**

```powershell
cd <dein-Projektordner>       # z. B. D:\claude-projects\Partykeller\Partykeller-Counter
git checkout main
git pull
Remove-Item -Recurse -Force node_modules   # nach Dependency-Updates wichtig
npm install
npm start
```

**macOS/Linux (bash):**

```bash
cd <dein-Projektordner>
git checkout main
git pull
rm -rf node_modules           # nach Dependency-Updates wichtig
npm install
npm start
```

Deine Daten (`data/partykeller.db`) und die `.env` sind gitignored und bleiben
beim Update erhalten. Meldet `git pull` „local changes" und du hast am Code
nichts geändert, hilft `git reset --hard origin/main` — das lässt `data/` und
`.env` unangetastet.

## Screens

| Route | Screen |
|---|---|
| `/` | Nutzer-Login (Name wählen/anlegen + PIN) |
| `/dashboard` | Nutzer-Dashboard: eigene Bier-/Shot-/Mischen-Zähler, Heute & Gesamt, Rang |
| `/tv` | TV-Scoreboard: umschaltbar All-Time / Heute (animiert), Podest Top 3, QR-Code zum Beitritt, ab Platz 4 durchscrollende Liste, Live-Fun-Facts (Tages-Bestleistungen) |
| `/admin` | Admin: Nutzer & Zähler (Bier/Shots/Mischen) verwalten, im TV ein-/ausblenden, TV-Ansicht umschalten, QR-Adresse setzen, Komplett-Reset (mit Passwort) |

## Stack

Node.js · Express · ws (WebSockets) · SQLite (better-sqlite3) ·
statisches Frontend ohne Build-Step. Ein Prozess serviert alles.

## Projekt-Dokumente

- [PLAN.md](PLAN.md) — Architektur, Datenmodell, API-/WS-Contract, Meilensteine
- [PROGRESS.md](PROGRESS.md) — Meilensteine mit Status (wird laufend abgehakt)
- [DECISIONS.md](DECISIONS.md) — Entscheidungen mit Begründung
- [CLAUDE.md](CLAUDE.md) — Projektregeln und Konventionen
- [Prompt.md](Prompt.md) — ursprüngliche Aufgabenstellung

## Betrieb auf dem Raspberry Pi

Anleitung in [deploy/PI-SETUP.md](deploy/PI-SETUP.md): systemd-Service
([deploy/partykeller.service](deploy/partykeller.service)), mDNS-Name
`partykeller.local`, TV im Chromium-Kiosk-Modus auf `/tv`, Backup der
`data/partykeller.db`. Konfiguration über `.env` (siehe `.env.example`).
