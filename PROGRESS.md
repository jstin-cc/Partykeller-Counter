# PROGRESS.md — Meilensteine & Status

Nach jedem abgeschlossenen Schritt hier abhaken und committen. Diese Datei ist
die Wahrheit über den Projektstand (Kontextverlust-sicher).

**Aktueller Stand:** Alle Meilensteine M0–M7 abgeschlossen — die App ist
funktional komplett (Login, Dashboard, TV-Scoreboard mit QR, Admin,
Pi-Deploy-Dateien) und end-to-end im Browser getestet.
Seit 2026-07-15 zusätzlich (D-012): **drittes Getränk „Mischen"** über alle
Screens (inkl. DB-Migration ohne Datenverlust), **Live-Fun-Facts**
(Tages-Bestleistungen), TV-Rangliste **scrollt** ab Platz 4 (Reset nach oben
statt Endlos-Rotation), Podest-Überlappung behoben, Tabellen als großes
gerundetes Panel mit einzeln gerundeten Zeilen, Wasserzeichen wieder rechts,
testweise dünner dunkelgrüner Glas-Rand.
**Offen:** echter Testlauf auf dem Pi mit 2 Handys + TV (M7, letzter Punkt).

## M0 — Planung & Projekt-Gerüst ✅

- [x] Design importiert und analysiert (Projekt „Getränke-Counter Partykeller", v3-Serie)
- [x] Rückfragen geklärt: Node.js / PIN verpflichtend / Admin-PW via .env / kein Minus-Button
- [x] PLAN.md: Architektur, Datenmodell, API-/WS-Contract, Routen, Ordnerstruktur, Meilensteine
- [x] DECISIONS.md mit D-001 … D-007 angelegt
- [x] CLAUDE.md, README.md, PROGRESS.md angelegt
- [x] Projekt-Gerüst: Ordnerstruktur, package.json, .env.example, .gitignore
- [x] **Freigabe des Plans durch den Nutzer** (PR #1 gemerged + „Los geht's")

## M1 — Server-Fundament ✅

- [x] `npm install` und Lockfile committen (express, ws, better-sqlite3, dotenv)
- [x] `server/config.js`: .env laden, PORT/ADMIN_PASSWORD/TOKEN_SECRET/DB_PATH validieren
- [x] `server/db.js`: Schema (players, drink_log), WAL-Modus, Query-Funktionen
- [x] `server/index.js`: Express + Statics + `GET /health` + `GET /api/state`
- [x] `server/ws.js`: WS-Endpoint `/ws`, State-Broadcast bei Connect und nach Mutationen
- [x] Dev-Seed-Script für Testnutzer (`npm run seed`, PIN 1111)

## M2 — Design-Basis ✅ (mit offenem Asset-Export)

- [x] Zapfen-Wasserzeichen vendored: `zapfen-bg.svg` (um 180° gedreht, D-009)
- [x] ~~Interims-SVGs für Logo und Wald-Footer (D-008)~~ → ersetzt
- [x] Finale Assets eingebunden (D-009): `logo.png` (weiß), `footer-woods.png`
      (echter Wald), `zapfen-bg.svg` (Hintergrund), `cones-flat.png` (Favicon)
- [x] Ecken leicht abgerundet (Tokens `--radius` / `--radius-lg`, D-009)
- [x] Fonts Bitter + Work Sans als woff2 nach `public/assets/fonts/` (offline!)
- [x] `public/css/theme.css`: Design-Tokens aus PLAN.md §8
- [x] `public/js/ws-client.js`: WS-Client mit Auto-Reconnect + State-Subscription
- [x] `public/js/api.js`: REST-Aufrufe + Token-Handling (localStorage)

## M3 — Nutzer-Dashboard (erster Screen) ✅

- [x] `public/dashboard.html` nach `User Dashboard v3.dc.html` (Kopfzeile mit Rang-Pill, Heute-Karte, Bier-/Shot-/Mischen-Karten, Abmelden)
- [x] `increment` über WS (+1 Bier / +1 Shot), Anzeige über State-Broadcast (LAN-Latenz vernachlässigbar)
- [x] Heute/Gesamt-Werte und Rang live aus dem State
- [x] Zustand „kein Nutzer ausgewählt" → Link zur Anmeldung
- [x] Serverseitig: increment-Handler inkl. drink_log + Party-Tag-Logik (06:00)
- [x] Auth: Nutzer-Login per REST + funktionale Login-Seite (Minimalversion, Feinschliff in M4)
- [x] End-to-end verifiziert: REST-Tests, WS-Rechte-Checks, Browser-Test mit Screenshots

## M4 — Nutzer-Login ✅

- [x] `public/index.html` nach `User Login v3.dc.html`: Avatar-Liste mit PIN-Zeile, Trenner, Neu-Anmelden-Formular, Admin-Link
- [x] Pflicht-PIN: Eingabe bei Anlage und Login (Design sagte „PIN (optional)", D-002 macht sie Pflicht), scrypt-Hash serverseitig
- [x] Token in localStorage, Redirect zum Dashboard, Abmelden-Flow

## M5 — TV-Scoreboard ✅

- [x] `public/tv.html` nach `TV Scoreboard v3.dc.html` (Querformat, Podest 2-1-3, Rangliste ab Platz 4, Kopf mit Teilnehmer-/Gesamt-Zahlen, live über WS)
- [x] QR-Code zum Beitritt (qrcode-generator vendored in `public/js/vendor/`)
- [x] QR-Adresse im Admin einstellbar (settings-Tabelle, `setJoinUrl`, D-010); QR-Rahmen nicht abgerundet
- [x] Podest kompakter; unter dem Podest max. 5 Plätze, bei mehr durchscrollend mit Reset nach oben (D-010/D-012)
- [x] Fun-Facts-Band jetzt live: Tages-Bestleistungen je Getränk (D-012)
- [x] Drittes Getränk „Mischen" auch im TV (Podest + Ranglisten-Spalte, D-012)

## M6 — Admin ✅

- [x] Admin-Login nach `Admin Login v3` (`POST /api/admin/login` gegen `ADMIN_PASSWORD`, Token in sessionStorage)
- [x] `public/admin.html` nach `Admin Dashboard v3`: Nutzer anlegen (mit Pflicht-PIN)/umbenennen/löschen (mit Rückfrage)
- [x] Zähler jedes Nutzers (Bier/Shots/Mischen): ±1-Stepper (`increment`) und Direkteingabe (`setCounter`), PIN-Reset (`setPin`, D-002)
- [x] Geschützter Komplett-Reset: Gedrückt-halten-Button (~1,2 s) → `reset` mit confirm "RESET"

## M7 — Betrieb auf dem Pi ✅ (bis auf echten Pi-Testlauf)

- [x] `deploy/partykeller.service` (systemd, Restart=always, EnvironmentFile)
- [x] `deploy/PI-SETUP.md`: Installation, avahi/mDNS (`partykeller.local`), Chromium-Kiosk-Autostart für `/tv`, Backup, Update
- [x] README finalisiert (Schnellstart, Screens, Pi-Verweis)
- [x] Server-Neustart ohne Datenverlust verifiziert (8 Nutzer vor/nach Neustart)
- [ ] Echter Testlauf auf dem Pi: 2 Handys + TV im WLAN

## Verifikation (2026-07-14)

Browser-Tests (Chromium): Login mit PIN → Dashboard; „+ Bier" am Handy
aktualisiert das TV-Podest live; Admin-Login → −1 Bier per Stepper →
Nutzer anlegen per Modal; Komplett-Reset nullt Zähler und Log, Accounts
bleiben. Dabei gefundener und gefixter Bug: `[hidden]` gegen
`display:flex`-Regeln (jetzt global in theme.css gelöst).
