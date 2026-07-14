# PROGRESS.md — Meilensteine & Status

Nach jedem abgeschlossenen Schritt hier abhaken und committen. Diese Datei ist
die Wahrheit über den Projektstand (Kontextverlust-sicher).

**Aktueller Stand:** Plan freigegeben (PR #1 gemerged). M0–M3 abgeschlossen:
Server-Fundament, Design-Basis und Nutzer-Dashboard laufen und sind
end-to-end getestet (REST + WS + Browser-Screenshot). Nächster Schritt: M4
(Login-Screen nach v3-Design verfeinern) oder M5 (TV-Scoreboard).
Offen aus M2: die zwei Original-PNGs (logo-gold, footer-woods) einmal
manuell aus dem Design-Projekt nach `public/assets/` exportieren (D-008).

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

- [x] `zapfen-raw.svg` aus dem Design-Projekt vendored
- [x] Interims-SVGs für Logo und Wald-Footer (D-008)
- [ ] **Offen:** `logo-gold.png` + `footer-woods.png` manuell aus dem Design-Projekt
      exportieren und nach `public/assets/` legen (Original > API-Limit von 256 KiB),
      dann die zwei `<img src>`-Verweise auf .png umstellen
- [x] Fonts Bitter + Work Sans als woff2 nach `public/assets/fonts/` (offline!)
- [x] `public/css/theme.css`: Design-Tokens aus PLAN.md §8
- [x] `public/js/ws-client.js`: WS-Client mit Auto-Reconnect + State-Subscription
- [x] `public/js/api.js`: REST-Aufrufe + Token-Handling (localStorage)

## M3 — Nutzer-Dashboard (erster Screen) ✅

- [x] `public/dashboard.html` nach `User Dashboard v3.dc.html` (Kopfzeile mit Rang-Pill, Heute-Karte, Bier-/Shot-Karten, Abmelden)
- [x] `increment` über WS (+1 Bier / +1 Shot), Anzeige über State-Broadcast (LAN-Latenz vernachlässigbar)
- [x] Heute/Gesamt-Werte und Rang live aus dem State
- [x] Zustand „kein Nutzer ausgewählt" → Link zur Anmeldung
- [x] Serverseitig: increment-Handler inkl. drink_log + Party-Tag-Logik (06:00)
- [x] Auth: Nutzer-Login per REST + funktionale Login-Seite (Minimalversion, Feinschliff in M4)
- [x] End-to-end verifiziert: REST-Tests, WS-Rechte-Checks, Browser-Test mit Screenshots

## M4 — Nutzer-Login

- [ ] `public/index.html` nach `User Login v3.dc.html`: Name wählen (Liste) oder anlegen
- [ ] Pflicht-PIN: Eingabe bei Anlage und Login, scrypt-Hash serverseitig
- [ ] Token in localStorage, Redirect zum Dashboard, Abmelden-Flow

## M5 — TV-Scoreboard

- [ ] `public/tv.html` nach `TV Scoreboard v3.dc.html` (Querformat, Podest Top 3, Rangliste, live)
- [ ] QR-Code zum Beitritt (vendored Lib, zeigt auf `http://partykeller.local:<PORT>/`)

## M6 — Admin

- [ ] Admin-Login (`POST /api/admin/login` gegen `ADMIN_PASSWORD`)
- [ ] `public/admin.html` nach Admin-v3-Designs: Nutzer anlegen/umbenennen/löschen
- [ ] Zähler jedes Nutzers direkt bearbeiten (`setCounter`), PIN-Reset (`setPin`)
- [ ] Geschützter Komplett-Reset (`reset` mit Bestätigung)

## M7 — Betrieb auf dem Pi

- [ ] `deploy/partykeller.service` (systemd, Restart=always, EnvironmentFile)
- [ ] `deploy/PI-SETUP.md`: avahi/mDNS (`partykeller.local`), Chromium-Kiosk-Autostart für `/tv`
- [ ] README finalisieren (Install, Betrieb, Backup der data/)
- [ ] End-to-End-Testlauf: 2 Handys + TV, Server-Neustart ohne Datenverlust
