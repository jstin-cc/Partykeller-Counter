# PROGRESS.md — Meilensteine & Status

Nach jedem abgeschlossenen Schritt hier abhaken und committen. Diese Datei ist
die Wahrheit über den Projektstand (Kontextverlust-sicher).

**Aktueller Stand:** M0 abgeschlossen. Plan wartet auf Freigabe — bis dahin
kein Feature-Code (M1+ gesperrt).

## M0 — Planung & Projekt-Gerüst ✅

- [x] Design importiert und analysiert (Projekt „Getränke-Counter Partykeller", v3-Serie)
- [x] Rückfragen geklärt: Node.js / PIN verpflichtend / Admin-PW via .env / kein Minus-Button
- [x] PLAN.md: Architektur, Datenmodell, API-/WS-Contract, Routen, Ordnerstruktur, Meilensteine
- [x] DECISIONS.md mit D-001 … D-007 angelegt
- [x] CLAUDE.md, README.md, PROGRESS.md angelegt
- [x] Projekt-Gerüst: Ordnerstruktur, package.json, .env.example, .gitignore
- [ ] **Freigabe des Plans durch den Nutzer** ⬅ blockiert M1+

## M1 — Server-Fundament

- [ ] `npm install` und Lockfile committen (express, ws, better-sqlite3, dotenv)
- [ ] `server/config.js`: .env laden, PORT/ADMIN_PASSWORD/TOKEN_SECRET/DB_PATH validieren
- [ ] `server/db.js`: Schema (players, drink_log), WAL-Modus, Query-Funktionen
- [ ] `server/index.js`: Express + Statics + `GET /health` + `GET /api/state`
- [ ] `server/ws.js`: WS-Endpoint `/ws`, State-Broadcast bei Connect und nach Mutationen
- [ ] Dev-Seed-Script für Testnutzer

## M2 — Design-Basis

- [ ] Assets aus dem Design-Projekt vendoren (logo-gold.png, footer-woods.png, zapfen-raw.svg)
- [ ] Fonts Bitter + Work Sans als woff2 nach `public/assets/fonts/` (offline!)
- [ ] `public/css/theme.css`: Design-Tokens aus PLAN.md §8
- [ ] `public/js/ws-client.js`: WS-Client mit Auto-Reconnect + State-Subscription
- [ ] `public/js/api.js`: REST-Aufrufe + Token-Handling (localStorage)

## M3 — Nutzer-Dashboard (erster Screen, nach Freigabe)

- [ ] `public/dashboard.html` nach `User Dashboard v3.dc.html` (Kopfzeile mit Rang-Pill, Heute-Karte, Bier-/Shot-Karten, Abmelden)
- [ ] `increment` über WS (+1 Bier / +1 Shot), optimistisch + Broadcast-Abgleich
- [ ] Heute/Gesamt-Werte und Rang live aus dem State
- [ ] Zustand „kein Nutzer ausgewählt" → Link zur Anmeldung
- [ ] Serverseitig: increment-Handler inkl. drink_log + Party-Tag-Logik (06:00)
- [ ] Auth: Nutzer-Login per REST vorhanden (minimal, damit der Screen echt testbar ist)

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
