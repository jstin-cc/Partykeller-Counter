# PROGRESS.md — Meilensteine & Status

Nach jedem abgeschlossenen Schritt hier abhaken und committen. Diese Datei ist
die Wahrheit über den Projektstand (Kontextverlust-sicher).

**Aktueller Stand:** Alle Meilensteine M0–M8 abgeschlossen — die App ist
funktional komplett (Login, Dashboard mit Profil-Tab, TV-Scoreboard mit QR,
Admin, Abend-Archiv mit Bearbeitung und CSV-Export) und end-to-end im Browser
getestet.
Seit 2026-09-01 (D-028–D-031): **Verlaufsgraph auf jeder Abend-Karte**
(Getränke pro Stunde, alle zusammen, Spitzenstunde hervorgehoben),
**Abende benennbar** (Feld im Bearbeiten-Dialog, also nur für Admins; Name
steht auf der Karte und im TV-Titel), **„Ganze Rangliste ansehen"** im Profil
(Blatt von unten, Heute/All-Time umschaltbar, eigene Zeile markiert und
angesteuert), **Treue-Abzeichen** ab 10 Abenden (10/20/50/100/200, immer nur
die höchste Stufe) und der grüne Balken im Zählen/Profil-Umschalter **gleitet**
jetzt, statt zu springen.
Seit 2026-08-31 (D-025, D-026, D-027): **CSV-Übergabedateien im Abend-Archiv**
— „⬇ CSV" auf jeder Abend-Karte und „⬇ Alle Abende als CSV" im Kopf, Langformat
(eine Zeile je Abend und Person) mit Semikolon/BOM für Excel, **nur mit
Admin-Login** (Knöpfe und Endpunkte, D-027); und das
**Fun-Fact-Band auf dem TV ist jetzt eine Ranglistenzeile hoch** mit Text in
Namensgröße, lange Facts skalieren automatisch herunter.
Seit 2026-08-26 (M8, Feedback aus der einwöchigen Testphase, D-021–D-023):
**TV-Board skaliert auf jeder Auflösung identisch** (1080p-Design-Bühne,
Tabelle bekommt allen Restplatz, Rotation robust neu geschrieben inkl.
Neuberechnung bei Resize), **Abende im Archiv bearbeitbar** (±1 je
Spieler/Sorte, wirkt auf Log + All-Time), **Archiv-Abend nochmal auf dem TV**
(Admin-Auswahl + Button auf der Archiv-Karte), **eigene Fun-Facts bearbeitbar**,
**Profil-Tab** im Dashboard (Platz heute/all-time mit Vorder-/Hintermann und
Abstand, Ø pro Abend), **Abzeichen mit Zähler über alle Abende** plus neues
Abzeichen **👑 Tagessieger**, **sechs neue Statistik-Fun-Facts** fürs TV-Band.
Der D-020-Tiebreak (Uhrzeit statt Alphabet) gilt jetzt auch für Archiv-Sieger
und Tagessieger. Betrieb läuft künftig voraussichtlich auf einem Laptop statt
Raspberry Pi (Pi-Dateien bleiben nutzbar).
Seit 2026-07-15 zusätzlich (D-012): **drittes Getränk „Mischen"** über alle
Screens (inkl. DB-Migration ohne Datenverlust), **Live-Fun-Facts**
(Tages-Bestleistungen), TV-Rangliste **scrollt** ab Platz 4 (Reset nach oben
statt Endlos-Rotation), Podest-Überlappung behoben, Tabellen als großes
gerundetes Panel mit einzeln gerundeten Zeilen, Wasserzeichen wieder rechts.
Und (D-013): **Komplett-Reset mit Passwort**, **Nutzer im TV
ein-/ausblendbar** (Haken im Admin), **TV-Ansicht All-Time/Heute umschaltbar**
(im Admin, animierter Wechsel), grüner Glas-Rand wieder zurückgenommen,
durchgängig **Übergänge/Animationen** (Button-Druck, Pop beim Hochzählen,
Podest-Effekte), Dashboard-Logo größer, Fun-Facts verdecken die Bäume nicht mehr.
Und (D-014): **Animationen auch in der Rangliste** (Pop/Aufleuchten bei neuem
Getränk, FLIP bei Platzwechsel), **Fun-Facts mit Tagesrekorden** (schön formuliert),
**eigenes Lösch-Passwort** (`RESET_PASSWORD`, getrennt vom Admin), **Admin-Liste
alphabetisch**, Glassmorphism-Kasten um den TV-QR-Code.
Seit 2026-07-16 (D-015): **TV-Rotationstempo im Admin einstellbar**, **eigene
Fun-Facts** (Titel + Text, Admin-Pflege, rotieren im TV-Band mit), **„Heute"-
Ansicht zeigt nur Spieler mit Getränk am laufenden Party-Tag** (Haken gilt nur
All-Time), **Abend-Archiv `/abende`** (Karten je Party-Tag: Sieger, Teilnehmer,
Mengen), **persönliche Statistik + Achievement-Badges** im Nutzer-Dashboard,
**PWA-installierbar** (Manifest + Icons + cache-freier Mini-Service-Worker),
**Rate-Limit auf beide Logins** (5 Fehlversuche/min → 60 s Sperre).
Kleinere Politur: Der Zapfen-Hintergrund ist jetzt `position: fixed` und
bleibt beim Scrollen fest im Viewport (Login, Dashboard, Admin, Abend-Archiv).
Und (D-016): **Fun-Fact-Wechseltakt im Admin einstellbar** (Regler 30 s – 5 min,
`funfact_seconds`, TV übernimmt live).
Und (D-017, nach Security-Review): **Kontoerstellung gedrosselt** (6/min/IP +
Deckel 200) und **Spieler-Increments pro Spieler gedrosselt** (Token-Bucket
~1/s, Burst 5; Admins ungedrosselt) – gegen Skript-Spam.
Und (D-018): **PIN wieder optional pro Nutzer** (ersetzt die Pflicht aus D-002).
Ohne PIN meldet ein Antippen direkt an; PIN-Konten bleiben geschützt. Admin
kann PINs setzen/entfernen, PIN-lose Nutzer sind in der Admin-Liste markiert.
Seit 2026-07-17 (D-019): **zweiter Bereich „Youngstars"** — `/` ist jetzt eine
Auswahlseite, darunter `/partykeller/*` (unverändert grün) und `/youngstars/*`
(Navy + Orange/Pink, Youngstars-Neon-Logo neben dem Partykeller-Logo, Navy-
Zapfen, kein Baum-Footer, Bier in der Auswahl zuunterst). Komplett getrennte
Daten (eigene SQLite-Datei), bereichsgestempelte Tokens, eigener Admin-Zugang
(`YOUNGSTARS_ADMIN_PASSWORD`, **neu in der .env nötig!**), gemeinsames
Lösch-Passwort (Reset löscht nur den eigenen Bereich), eigenes PWA-Manifest
mit Orange-Icons. Alt-Pfade (`/tv`, `/api`, `/ws`, …) leiten auf den
Partykeller bzw. dienen ihm als Alias.
**Offen:** echter Testlauf auf dem Pi mit 2 Handys + TV (M7, letzter Punkt);
Youngstars-Logo durch die Original-PNG des Nutzers ersetzen, sobald sie im
Repo liegt (`public/assets/youngstars-logo.png`, Icons dann neu erzeugen).

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
- [x] Geschützter Komplett-Reset: Modal mit erneuter Admin-Passwort-Eingabe (D-013)
- [x] Nutzer im TV ein-/ausblenden (Haken, `setHidden`) und TV-Ansicht All-Time/Heute umschalten (`setBoardMode`, D-013)

## M7 — Betrieb auf dem Pi ✅ (bis auf echten Pi-Testlauf)

- [x] `deploy/partykeller.service` (systemd, Restart=always, EnvironmentFile)
- [x] `deploy/PI-SETUP.md`: Installation, avahi/mDNS (`partykeller.local`), Chromium-Kiosk-Autostart für `/tv`, Backup, Update
- [x] README finalisiert (Schnellstart, Screens, Pi-Verweis)
- [x] Server-Neustart ohne Datenverlust verifiziert (8 Nutzer vor/nach Neustart)
- [ ] Echter Testlauf auf dem Pi: 2 Handys + TV im WLAN
      (entschärft: Betrieb läuft voraussichtlich auf einem Laptop)

## M8 — Überarbeitung nach der Testwoche (2026-08-26) ✅

- [x] TV-Board: 1080p-Design-Bühne mit `transform: scale()` — Layout auf jeder
      Auflösung identisch, Tabelle bekommt allen Restplatz (D-021)
- [x] TV-Rotation neu: feste Zeilenhöhe, sichtbare Zeilen aus dem Platz
      berechnet, Neuberechnung bei Resize/Font-Swap, weiches Ausblenden der
      angeschnittenen Zeile; Tempo-Regler wirkt live
- [x] Abend-Archiv bearbeitbar: Admin-Modal auf `/abende`, ±1 je
      Spieler/Sorte/Party-Tag, wirkt transaktional auf Log + All-Time (D-022)
- [x] Archiv-Abend auf dem TV: Board-Modus `archive` + Tagesauswahl im Admin
      und „Auf dem TV zeigen" auf den Archiv-Karten (D-022)
- [x] Eigene Fun-Facts bearbeitbar (updateFact + Inline-Formular im Admin)
- [x] Dashboard: Profil-Tab (Platz heute/all-time, Vorder-/Hintermann mit
      Abstand, Ø pro Abend, Verteilung, Abzeichen) — Eingabe-Tab nur noch
      Zählen (D-023)
- [x] Abzeichen mit Zähler über alle Abende + neues Abzeichen 👑 Tagessieger
- [x] Sechs neue Statistik-Fun-Facts (Rekord-Abend, Stammgast, Seriensieger,
      Frühstart, durstigste Stunde, Gesamtbilanz)
- [x] Rekordkurs (Bier-Pace) live auf dem TV: glühende Pill + Fun-Fact, wenn
      der Abend vor dem besten bisherigen Abend liegt (D-024)
- [x] D-020-Tiebreak auch für Archiv-Sieger/Tagessieger
- [x] CSV-Übergabedateien im Abend-Archiv: pro Abend und über alle Abende,
      Langformat mit Semikolon/CRLF/BOM fürs deutsche Excel (D-025)
- [x] CSV-Export nur mit Admin-Login: Knöpfe erscheinen nur als Admin, die
      Endpunkte prüfen das Admin-Token im Authorization-Header (D-027)
- [x] Fun-Fact-Band auf dem TV so hoch wie eine Ranglistenzeile, Text in
      Namensgröße, lange Facts skalieren automatisch herunter (D-026)
- [x] Verlaufsgraph (Getränke pro Stunde) auf jeder Abend-Karte (D-029)
- [x] Abende benennbar im Bearbeiten-Dialog, Name auf Karte + TV-Titel (D-028)
- [x] „Ganze Rangliste ansehen" im Profil, Heute/All-Time umschaltbar (D-030)
- [x] Treue-Abzeichen nach Anzahl der Abende, nur die höchste Stufe (D-031)
- [x] Grüner Balken im Zählen/Profil-Umschalter gleitet statt zu springen

## Verifikation (2026-09-01, D-028–D-031)

Browser-Tests (Chromium, Testdatenbank mit 15 Abenden): Archiv-Karten zeigen
den Stundenverlauf inkl. Spitzenstunde und Achsenbeschriftung (auch für den
laufenden Abend); „Bearbeiten" → Name „Saisonabschluss" gespeichert →
erscheint auf der Karte und nach „Auf dem TV zeigen" im TV-Titel
(„SAISONABSCHLUSS · 31.08.2026"); Dashboard-Profil: Treue-Abzeichen
„🎖 Stammgast ×15" mit Tooltip zur nächsten Stufe, „Ganze Rangliste ansehen"
öffnet das Blatt mit 12 Zeilen (eigene Zeile markiert, „Basti (du)"),
Umschalten auf Heute zeigt 6 Personen, Escape schließt; der grüne Balken im
Umschalter wandert gemessen von x=30 über x=200 nach x=213 (gleitet also,
statt zu springen) und ist exakt so breit wie ein Knopf. Keine Konsolenfehler.

## Verifikation (2026-08-26, M8)

Server-Tests (WS): Archiv-Modus liefert `boardDay` + sortierte
`archivePlayers` und räumt sie beim Zurückschalten wieder auf; ungültiger Tag
und Spieler-Token werden abgelehnt; `adjustArchive` ±1 ändert Tages-Log und
All-Time-Zähler konsistent, „–1 auf leer" wird abgelehnt; `updateFact` ändert
Titel + Text. Browser-Tests (Chromium, 1920×1080 / 1366×768 / 1280×800 /
1093×614@125 %): TV-Layout auf allen Auflösungen identisch (7 sichtbare
Zeilen + Podest), Rotation läuft komplett durch und resettet nach oben,
Youngstars-TV (Navy) fehlerfrei; Admin: Archiv-Auswahl + Fact-Bearbeitung;
`/abende` als Admin: Bearbeiten-Modal (+1/−1 live), „Auf dem TV zeigen" →
TV zeigt „Abend vom 24.08.2026"; Dashboard-Profil: Platz, Nachbarn
(inkl. „gleichauf"-Fall), Ø pro Abend, Abzeichen-Zähler. Keine Konsolenfehler.

## Verifikation (2026-07-17, D-019)

Server-Tests: Youngstars-Nutzer erscheinen nicht im Partykeller-State (und
umgekehrt), `/api`+`/ws` == Partykeller; Admin-Passwörter wirken nur im eigenen
Bereich; Partykeller-Tokens werden am Youngstars-WS abgelehnt (und umgekehrt);
Reset nullt nur den auslösenden Bereich; Settings unabhängig. Browser-Tests
(Chromium): Auswahlseite mit beiden Karten; Youngstars-Login in Navy mit beiden
Logos und ohne Baum-Footer; Dashboard-Reihenfolge Shots/Mischen/Bier; eigener
Admin (test-Passwort) mit Orange-Theme; TV in Navy ohne Footer; Partykeller-
Screens unverändert grün. Keine Konsolenfehler.

## Verifikation (2026-07-16, D-015)

Server-Tests: Rate-Limit blockt nach 5 Fehlversuchen beide Logins mit 429 und
Restzeit; `setScrollSpeed`/`addFact`/`deleteFact` nur als Admin, Wertebereiche
geprüft; `scroll_seconds`, Facts und Board-Modus überleben den Neustart.
Browser-Tests (Chromium): Heute-Ansicht zeigt nur die 6 Spieler mit Log heute
(„6 heute dabei"), Zeilenhöhe bleibt im 5er-Raster; Admin-Regler stellt das
Tempo live um; eigene Meldung erscheint mit Titel im TV-Band; Dashboard zeigt
Statistik (3 Abende, bestes Ergebnis 13 am 25.09.2025) und 3 verdiente Badges;
`/abende` listet 3 Party-Tage mit Siegern; Manifest + `sw.js` liefern 200.
Keine Konsolenfehler.

## Verifikation (2026-07-14)

Browser-Tests (Chromium): Login mit PIN → Dashboard; „+ Bier" am Handy
aktualisiert das TV-Podest live; Admin-Login → −1 Bier per Stepper →
Nutzer anlegen per Modal; Komplett-Reset nullt Zähler und Log, Accounts
bleiben. Dabei gefundener und gefixter Bug: `[hidden]` gegen
`display:flex`-Regeln (jetzt global in theme.css gelöst).
