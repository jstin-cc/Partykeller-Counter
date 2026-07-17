# Plan: Getränke-Counter Partykeller

Stand: 2026-07-14 · Status: **wartet auf Freigabe** — bis dahin wird kein Feature-Code geschrieben.

## 1. Ziel & Rahmenbedingungen

Ein Getränke-Counter für den Partykeller: Gäste zählen Biere und Shots am Handy,
ein TV zeigt die dauerhafte All-Time-Rangliste. Alles läuft in einem einzigen
Prozess auf einem Raspberry Pi im lokalen WLAN — **ohne Internet-Abhängigkeit**.

Verbindliche Design-Vorlage: Claude-Design-Projekt „Getränke-Counter Partykeller"
(`88f5d903-cd4e-489d-9ce7-d904fffe8155`), umzusetzende Datei für den ersten
Screen: **User Dashboard v3.dc.html**. Details der Design-Analyse in
[DECISIONS.md](DECISIONS.md) und Abschnitt 8.

## 2. Architektur

Ein Node.js-Prozess serviert alles:

```
┌──────────────────────────── Raspberry Pi ────────────────────────────┐
│  Node.js (ein Prozess, Port aus .env, Default 3000)                  │
│  ├── Express: statische Views (public/) + kleine REST-API (Auth)     │
│  ├── ws: WebSocket /ws — Mutationen rein, State-Broadcast raus       │
│  └── better-sqlite3: data/partykeller.db (synchron, WAL-Modus)       │
└───────────────────────────────────────────────────────────────────────┘
        ▲                    ▲                       ▲
   Handy (Login +       Handy (weitere         TV im Kiosk-Browser
   Dashboard)           Gäste)                 (Scoreboard + QR)
```

- **Frontend ohne Build-Step**: statisches HTML/CSS/Vanilla-JS (ES-Module).
  Kein Bundler, kein Framework — passt zur App-Größe, läuft ewig ohne Wartung.
- **Realtime**: Nach jeder Änderung broadcastet der Server den kompletten State
  an alle verbundenen Clients (State ist klein, Diff-Logik lohnt nicht).
- **Offline-Regel**: Keine CDN-Ressourcen. Fonts (Bitter, Work Sans) und alle
  Assets werden lokal in `public/assets/` vendored.

## 3. Datenmodell (SQLite)

```sql
CREATE TABLE players (
  id         TEXT PRIMARY KEY,            -- z. B. nanoid/uuid
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pin_hash   TEXT NOT NULL,               -- scrypt-Hash (node:crypto); leer '' = keine PIN (D-018)
  beers      INTEGER NOT NULL DEFAULT 0,  -- All-Time-Zähler
  shots      INTEGER NOT NULL DEFAULT 0,
  mixes      INTEGER NOT NULL DEFAULT 0,  -- „Mischen" (D-012)
  hidden     INTEGER NOT NULL DEFAULT 0,  -- aus dem TV-Scoreboard ausgeblendet (D-013)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE drink_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  drink     TEXT NOT NULL CHECK (drink IN ('beer','shot','mix')),
  ts        INTEGER NOT NULL              -- Unix-Millis
);
CREATE INDEX idx_drink_log_player_ts ON drink_log(player_id, ts);

CREATE TABLE facts (                       -- eigene Fun-Facts/Meldungen (D-015)
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,                -- kurzer Titel (z. B. „Ansage")
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- `beers`/`shots`/`mixes` bleiben die schnelle All-Time-Wahrheit (wie in Prompt.md).
- `drink_log` ergänzt das Prompt-Modell: das v3-Design zeigt zusätzlich
  **„Getränke heute"**. „Heute" = Party-Tag von **06:00 bis 05:59** des
  Folgetags (aus dem Design-Prototyp übernommen).
- Gesamt wird abgeleitet: `total = beers + shots + mixes`; Rang = Sortierung nach total.
- Bestehende DBs werden beim Start migriert (mixes-/hidden-Spalte, erweiterte CHECK),
  ohne Datenverlust (D-006/D-012/D-013).
- `settings` (Schlüssel/Wert) hält Laufzeit-Einstellungen: `join_url` (TV-QR-Ziel,
  D-010), `board_mode` (`alltime`|`today`, TV-Ansicht, D-013) und
  `scroll_seconds` (Verweildauer pro Ranglisten-Scroll-Schritt am TV, D-015)
  und `funfact_seconds` (Wechseltakt des Fun-Fact-Bands, 30–300 s, D-016).
- `getState().records` liefert je Sorte den All-Time-Tagesrekord (Spieler, Datum,
  Anzahl) für die Fun-Facts (D-014); der destruktive Reset ist mit einem eigenen
  Passwort `RESET_PASSWORD` abgesichert (getrennt von `ADMIN_PASSWORD`, D-013/D-014).
- Admin-Korrekturen ändern nur die Zähler (kein Log-Eintrag); Komplett-Reset
  leert Zähler und Log.

## 4. Auth

- **Nutzer**: Account = Name + optionale PIN (4-stellig, D-018 – ersetzt die
  frühere Pflicht aus D-002). Ohne PIN meldet ein Antippen des Namens direkt an;
  mit PIN wird sie abgefragt. Login gibt ein HMAC-signiertes Token zurück
  (Secret aus `.env`, stateless → übersteht Server-Neustarts). Token liegt im
  `localStorage` des Handys, Re-Login nur bei Gerätewechsel nötig.
- **Admin**: Passwort aus `.env` (`ADMIN_PASSWORD`), Login gibt ein Admin-Token
  (gleicher Mechanismus, Rolle im Token).
- PINs werden nur gehasht gespeichert (scrypt aus `node:crypto`, keine Extra-Dependency).

## 5. API- & WebSocket-Contract

### REST (nur Auth + Initialzustand)

| Route | Body | Antwort |
|---|---|---|
| `POST /api/players` | `{name, pin}` | `201 {player, token}` — Account anlegen |
| `POST /api/login` | `{playerId, pin}` | `{player, token}` |
| `POST /api/admin/login` | `{password}` | `{token}` |
| `GET /api/state` | – | kompletter State (Initial-Load/Fallback) |
| `GET /api/archive` | – | `{days: […]}` — Abend-Archiv: je Party-Tag Sieger, Teilnehmer, Mengen (D-015) |
| `GET /api/players/:id/stats` | – | persönliche Statistik + Achievements fürs Dashboard (D-015) |
| `GET /health` | – | `{ok: true}` |

Die Login-Endpunkte sind rate-limitiert (D-015): nach 5 Fehlversuchen binnen
1 min pro IP → 60 s Sperre (HTTP 429); erfolgreicher Login setzt zurück.
Missbrauchsschutz (D-017): `POST /api/players` ist auf 6 neue Konten pro Minute
und IP begrenzt (plus Gesamt-Deckel 200); Spieler-`increment` über WS ist pro
Spieler gedrosselt (Token-Bucket ~1/s, Burst 5), Admins ungedrosselt.

### WebSocket `/ws`

**Server → alle Clients** (nach jeder Änderung und bei Connect):

```jsonc
{
  "type": "state",
  "players": [
    { "id": "…", "name": "Basti", "beers": 14, "shots": 6, "total": 20,
      "rank": 1, "beersToday": 3, "shotsToday": 1, "createdAt": "…" }
  ]
}
// Fehler an den Verursacher: { "type": "error", "message": "…" }
```

**Client → Server** (Nachrichtennamen aus Prompt.md, `token` in jeder Nachricht):

| Nachricht | Wer | Regel |
|---|---|---|
| `increment(playerId, drink, delta)` | Nutzer/Admin | Nutzer: nur eigene `playerId`, nur `delta = +1` (Design hat bewusst keinen Minus-Button, schreibt zusätzlich ins `drink_log`). Admin: beliebiges delta, Zähler nie < 0. |
| `addPlayer(name, pin)` | Admin | Nutzer legen sich selbst per REST an |
| `renamePlayer(id, name)` | Admin | Name bleibt unique |
| `setPin(id, pin)` | Admin | PIN-Reset für Nutzer, die sie vergessen |
| `setCounter(id, drink, value)` | Admin | Zähler direkt setzen (Admin-Dashboard) |
| `deletePlayer(id)` | Admin | inkl. Log (CASCADE) |
| `reset(confirm)` | Admin | Komplett-Reset, nur mit `confirm: "RESET"` |
| `setHidden(id, hidden)` | Admin | Sichtbarkeit in der All-Time-Ansicht (D-013/D-015) |
| `setBoardMode(mode)` | Admin | TV-Ansicht `alltime`\|`today` (D-013) |
| `setScrollSpeed(seconds)` | Admin | Ranglisten-Rotation am TV, 1–30 s (D-015) |
| `setFunfactSpeed(seconds)` | Admin | Wechseltakt des Fun-Fact-Bands, 30–300 s (D-016) |
| `addFact(title, text)` / `deleteFact(id)` | Admin | eigene Fun-Facts fürs TV-Band (D-015) |
| `setJoinUrl(url)` | Admin | Ziel des TV-QR-Codes (D-010) |

Der Server validiert jede Nachricht serverseitig (Token, Rolle, Wertebereiche) —
Clients sind nicht vertrauenswürdig.

## 6. Routen & Screens

Seit D-019 gibt es **zwei Bereiche** mit identischen Screens und komplett
getrennten Daten: **Partykeller** (`/partykeller/*`, Dunkelgrün) und
**Youngstars** (`/youngstars/*`, Navy/Orange). `/` ist die Auswahlseite.
Dieselben HTML-Dateien bedienen beide Bereiche; `public/js/area.js` erkennt
den Bereich am URL-Präfix (API-/WS-Präfix, Storage-Keys, Theme via
`html[data-area]`).

| Route (je Bereich unter `/partykeller` bzw. `/youngstars`) | Screen | Design-Datei | Format |
|---|---|---|---|
| `/` | Auswahlseite: Partykeller oder Youngstars (`start.html`) | eigenes Layout im Theme (D-019) | Handy/Desktop |
| `<bereich>/` | Nutzer-Login (Name wählen/anlegen, PIN optional) | `User Login v3.dc.html` | Handy, hoch |
| `<bereich>/dashboard` | **Nutzer-Dashboard** (Youngstars: Bier zuunterst) | `User Dashboard v3.dc.html` | Handy, hoch |
| `<bereich>/tv` | TV-Scoreboard: Rangliste, Podest Top 3, QR-Code zum Beitritt | `TV Scoreboard v3.dc.html` | TV, quer |
| `<bereich>/admin` | Admin-Login → Admin-Dashboard (eigenes Passwort je Bereich) | `Admin Login/Dashboard v3.dc.html` | Handy/Desktop |
| `<bereich>/abende` | Abend-Archiv: jeder Party-Tag als Karte (Sieger, Teilnehmer, Mengen) | eigenes Layout im Theme (D-015) | Handy/Desktop |

Alt-Pfade (`/dashboard`, `/tv`, `/admin`, `/abende`, `/api/*`, `/ws`) leiten
auf den Partykeller-Bereich bzw. dienen ihm als Alias — gespeicherte QR-Codes,
Lesezeichen und der Pi-Kiosk funktionieren weiter.

QR-Code auf dem Scoreboard zeigt auf `http://partykeller.local:<PORT>/<bereich>/`
(Generierung client-seitig mit vendored `qrcode`-Lib, offline-fähig).

## 7. Ordnerstruktur

```
Partykeller-Counter/
├── CLAUDE.md / PLAN.md / PROGRESS.md / DECISIONS.md / README.md / Prompt.md
├── package.json          # express, ws, better-sqlite3, dotenv
├── .env.example          # PORT, ADMIN_PASSWORD, TOKEN_SECRET, DB_PATH
├── .gitignore            # node_modules, .env, data/
├── server/
│   ├── index.js          # Entry: Express + ws + Startup
│   ├── config.js         # .env laden & validieren
│   ├── db.js             # Schema, Migrationen, Queries
│   ├── auth.js           # PIN-Hashing, Token signieren/prüfen
│   └── ws.js             # Message-Handler + Broadcast
├── public/
│   ├── index.html        # Nutzer-Login
│   ├── dashboard.html    # Nutzer-Dashboard
│   ├── tv.html           # TV-Scoreboard
│   ├── admin.html        # Admin-Login + -Dashboard
│   ├── css/theme.css     # Design-Tokens (siehe Abschnitt 8)
│   ├── js/               # shared: ws-client.js, api.js, qrcode (vendored)
│   └── assets/           # logo-gold.png, footer-woods.png, zapfen-raw.svg, fonts/
├── deploy/
│   ├── partykeller.service   # systemd-Unit für den Pi
│   └── PI-SETUP.md           # mDNS (avahi), Kiosk-Browser, Autostart
└── data/                 # partykeller.db (gitignored)
```

## 8. Design-Umsetzung (verbindlich: v3-Serie)

Aus dem importierten Design extrahierte Tokens → werden 1:1 `public/css/theme.css`:

```css
--ink: oklch(0.95 0.01 95);        --creme: oklch(0.92 0.035 88);
--ink-muted: oklch(0.68 0.02 100); --green: oklch(0.64 0.15 152);
--gold: oklch(0.80 0.15 83);       --amber: oklch(0.74 0.11 68);
--brick: oklch(0.56 0.14 38);      --bg: oklch(0.15 0.035 155);
--bg-hi: oklch(0.19 0.035 155);    --surface: oklch(0.25 0.035 55);
--surface-alt: oklch(0.21 0.03 55);--surface-2: oklch(0.30 0.04 55);
```

- **Typo**: Bitter (Headlines/Zahlen, 400–800) + Work Sans (Text, 400–700),
  als woff2 **lokal vendored** (Design lädt sie von Google Fonts — im
  Offline-WLAN nicht verfügbar).
- **Sprache/Stil**: dunkler Tannen-Grund, Karten mit 3px-Farbkante oben
  (Bier = amber, Shots = brick, Gesamt = green), `tabular-nums` für Zähler,
  Zapfen-Wasserzeichen, Wald-Footer, Gold-Logo.
- **Nutzer-Dashboard v3 konkret**: Kopfzeile (Wechseln-Link, Logo,
  Rang-Pill `#rank/total`), Name, Karte „Getränke heute" mit großem Tageswert
  + All-Time darunter, je eine Karte Bier/Shots mit großem Plus-Button und
  Heute/Gesamt-Spalten, Abmelden-Link. **Kein Minus-Button** (bestätigt) —
  Korrekturen macht der Admin.

## 9. Betrieb auf dem Pi (eingeplant, Ausbau in M7)

- Ein deploybarer Prozess: `node server/index.js`, Port über `.env`.
- `deploy/partykeller.service`: systemd-Unit mit `Restart=always`,
  `WorkingDirectory`, `EnvironmentFile=.env`.
- mDNS: avahi auf dem Pi → `partykeller.local` (Doku in `deploy/PI-SETUP.md`).
- TV: Chromium im Kiosk-Modus auf `http://localhost:<PORT>/tv` (Autostart-Doku).
- Persistenz: SQLite mit WAL; `data/` liegt außerhalb des Deploy-Artefakts,
  Neustart verliert nichts.

## 10. Meilensteine

Abhakbare Detail-Schritte stehen in [PROGRESS.md](PROGRESS.md).

- **M0 – Planung & Gerüst** (diese Session): Plan, Kontextdateien, Ordnerstruktur. ✅
- **M1 – Server-Fundament**: config, DB-Schema, Express + Statics, WS-Broadcast, `GET /api/state`, Seeds für Dev.
- **M2 – Design-Basis**: Assets & Fonts vendoren, `theme.css`, shared WS-Client mit Auto-Reconnect.
- **M3 – Nutzer-Dashboard** (erster Screen, nach Freigabe): `/dashboard` nach v3-Design, increment über WS, live Rang/Heute/Gesamt.
- **M4 – Nutzer-Login**: Name wählen/anlegen + optionale PIN (D-018), Token-Handling.
- **M5 – TV-Scoreboard**: Rangliste, Podest Top 3, QR-Code, live.
- **M6 – Admin**: Login, Nutzer-Verwaltung, Zähler-Bearbeitung, geschützter Reset.
- **M7 – Betrieb**: systemd-Unit, mDNS-/Kiosk-Doku, README-Finale, Testlauf-Checkliste.

## 11. Geklärte Fragen

| Frage | Entscheidung |
|---|---|
| Stack Node vs. Rust | **Node.js** (Empfehlung angenommen) |
| PIN | **Verpflichtend** für jeden Account (Abweichung von der Empfehlung „optional") |
| Admin-Passwort | **`.env`** (Empfehlung angenommen) |
| Minus-Button | **Nein** — wie v3-Design nur Plus; Korrekturen über Admin |

Begründungen in [DECISIONS.md](DECISIONS.md).
