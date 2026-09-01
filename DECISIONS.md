# DECISIONS.md — Architektur- & Stack-Entscheidungen

Jede Entscheidung mit Datum, Kontext und Begründung. Neueste unten anfügen.

## 2026-07-14 · D-001: Stack = Node.js (statt Rust)

**Entscheidung:** Node.js + Express (Statics + REST), `ws` (WebSockets),
`better-sqlite3` (Persistenz), `dotenv` (Config). Ein Prozess für alles.

**Begründung:** Vom Nutzer bestätigt. Für eine LAN-App mit einer Handvoll
gleichzeitiger Clients ist Node mehr als ausreichend; `better-sqlite3` ist
synchron und damit trivial korrekt bei konkurrierenden Mutationen (ein
Event-Loop, keine Race Conditions). Rust hätte geringeren RAM-Bedarf, aber
deutlich höheren Entwicklungs- und Wartungsaufwand ohne praktischen Nutzen
auf einem Pi mit dieser Last.

## 2026-07-14 · D-002: PIN ist verpflichtend

**Entscheidung:** Jeder Account braucht eine PIN (4-stellig). Anlegen nur mit
PIN, Login nur mit PIN. Admin kann PINs zurücksetzen (`setPin`).

**Begründung:** Vom Nutzer so entschieden — bewusste Abweichung von der
Empfehlung in Prompt.md („optional, standardmäßig aus"). Schützt Accounts
gegen Spaß-Einträge anderer Gäste. Konsequenz: Der Login-Screen braucht
immer ein PIN-Feld, und der Admin braucht eine PIN-Reset-Funktion für
vergessene PINs.

## 2026-07-14 · D-003: Admin-Passwort über .env

**Entscheidung:** `ADMIN_PASSWORD` kommt aus `.env` (dokumentiert in
`.env.example`). Ohne gesetzten Wert startet der Server nicht (kein
unsicherer Default im Repo).

**Begründung:** Vom Nutzer bestätigt. Kein Passwort im Code/Repo, auf dem Pi
ohne Code-Änderung anpassbar. Der Design-Prototyp (`store.js`) hatte
`keller2026` hartcodiert — das wird nicht übernommen.

## 2026-07-14 · D-004: Kein Minus-Button im Nutzer-Dashboard

**Entscheidung:** Nutzer können nur hinzufügen (`delta = +1`). Korrekturen
macht ausschließlich der Admin über sein Dashboard (direktes Bearbeiten der
Zähler laut Prompt.md).

**Begründung:** Vom Nutzer bestätigt. Prompt.md nennt zwar „Plus/Minus", das
verbindliche v3-Design hat aber bewusst nur Plus-Buttons — und das
log-basierte „Heute"-Feature bleibt so konsistent (ein Log-Eintrag pro
Getränk, kein Entfernen-Pfad nötig).

## 2026-07-14 · D-005: drink_log ergänzt das Datenmodell aus Prompt.md

**Entscheidung:** Zusätzlich zu den All-Time-Zählern `beers`/`shots` auf dem
Player gibt es eine `drink_log`-Tabelle (`player_id`, `drink`, `ts`).
„Heute" = Party-Tag von 06:00 bis 05:59 des Folgetags.

**Begründung:** Das verbindliche v3-Design zeigt „Getränke heute" und
Heute/Gesamt-Spalten pro Getränk — das Prompt-Modell (nur All-Time-Zähler)
kann das nicht liefern. Die Zähler bleiben als schnelle All-Time-Wahrheit
erhalten (kein Aggregieren über das Log für die Rangliste); das Log dient
nur für Tageswerte. Party-Tag-Grenze 06:00 stammt aus dem Design-Prototyp
(`store.js`, `partyDayKey`). Admin-Korrekturen ändern nur Zähler, der
Komplett-Reset leert beides.

## 2026-07-14 · D-006: Stateless HMAC-Tokens statt Session-Tabelle

**Entscheidung:** Login (Nutzer wie Admin) liefert ein HMAC-signiertes Token
(Secret `TOKEN_SECRET` aus `.env`, Payload: playerId bzw. Rolle). Clients
speichern es im `localStorage` und senden es mit jeder WS-Nachricht.
PINs werden mit scrypt (`node:crypto`) gehasht.

**Begründung:** Übersteht Server-Neustarts ohne Session-Tabelle und ohne
Re-Login aller Gäste (wichtig: „Neustart darf nichts verlieren"). Keine
zusätzliche Dependency. Für ein privates LAN angemessen dimensioniert.

## 2026-07-14 · D-007: Kein Build-Step, keine CDN-Ressourcen

**Entscheidung:** Frontend als statisches HTML/CSS/Vanilla-JS (ES-Module),
kein Bundler/Framework. Fonts (Bitter, Work Sans) und die QR-Code-Lib werden
lokal in `public/` vendored.

**Begründung:** Die App läuft im WLAN ohne Internet — Google-Fonts-Links aus
dem Design würden dort nicht laden. Ohne Build-Step bleibt das Deployment
auf dem Pi ein `git pull` + Neustart, und das Projekt bleibt in Jahren noch
wartbar.

## 2026-07-14 · D-008: Interims-SVGs für Logo und Wald-Footer

**Entscheidung:** `logo-gold.svg` und `footer-woods.svg` sind selbstgebaute
Interims-Assets im Design-Stil. Die Original-PNGs aus dem Design-Projekt
(`assets/logo-gold.png`, `assets/footer-woods.png`) überschreiten das
256-KiB-Limit des Design-API-Exports und müssen einmal manuell exportiert
und nach `public/assets/` gelegt werden (offener Punkt in PROGRESS.md M2).

**Begründung:** Der Screen soll nicht an zwei Bilddateien scheitern. Die
SVGs nutzen dieselben Farb-Tokens und Platzverhältnisse, sodass der spätere
Tausch nur die zwei `<img src>`-Verweise betrifft. `zapfen-raw.svg` (das
Wasserzeichen) konnte 1:1 übernommen werden.

## 2026-07-15 · D-009: Finale Bild-Assets eingesetzt, Interims ersetzt

**Entscheidung:** Die vom Nutzer hochgeladenen Original-Assets sind jetzt
eingebunden; die Interims aus D-008 wurden gelöscht:

- `logo.png` — das weiße Logo (`SVPartykellerLogo2.0`), da die gesamte UI
  dunkel ist. (Die mitgelieferten „SVG"-Logos waren nur PNG-Raster in einem
  SVG-Rahmen, boten also keinen Vektorvorteil → PNG genommen.)
- `footer-woods.png` — der echte Wald-Streifen; der Abdunkel-Filter wurde von
  `brightness(0.55)` auf `0.8` gelockert, damit das Grün sichtbar bleibt.
- `zapfen-bg.svg` — der Rothaus-Zapfen (vom Nutzer als `gemini-svg` mit
  Grünfüllung `#11682e` geliefert), **fest um 180° gedreht** (Zapfen hängen nach
  unten) und mit fester Pixelgröße versehen. Weil die Drehung nun in der Datei
  steckt, entfielen die kompensierenden `rotate(180deg)` in Login/TV/Admin.
  Das Wasserzeichen wird als **Hintergrundbild** mit niedriger Deckkraft
  (~0.14–0.22) eingesetzt, nicht mehr als CSS-Maske: die frühere Masken-Variante
  (`mask-image` + `--bg-hi`) blieb auf dem fast schwarzen Grün unsichtbar. So
  scheinen die grünen Zapfen dezent durch — die vom Nutzer gewünschte, „leicht
  andere Helligkeit" gegenüber dem Rest.
- `cones-flat.png` — als Favicon eingebunden.

**Rundung:** Neue Tokens `--radius` (12px) und `--radius-lg` (18px) ersetzen
die bisherigen 3–4px-Ecken (Karten, Buttons, Felder, Stepper, Podest, QR),
sodass die eckigen Elemente durchgängig leicht abgerundet sind.

**Begründung:** Vom Nutzer angefordert. Alles bleibt offline/vendored
(D-007); keine neuen Dependencies. D-008 ist damit erledigt.

## 2026-07-15 · D-010: settings-Tabelle + einstellbare QR-Adresse, TV-Feinschliff

**Entscheidung:**

- Neue Tabelle `settings (key TEXT PRIMARY KEY, value TEXT)` als schlichter
  Schlüssel-Wert-Speicher. Erster Eintrag: `join_url` — die Adresse, auf die der
  TV-QR-Code zeigt. Sie steckt jetzt im persistenten State (`getState().joinUrl`)
  und übersteht damit Neustarts (D-006).
- Neuer WS-Handler `setJoinUrl` (admin-only). Eingaben werden über
  `normalizeJoinUrl()` validiert: leer = Fallback auf die eigene Server-Adresse,
  sonst zu einer vollständigen `http(s)`-URL normalisiert (fehlt das Schema, wird
  `http://` ergänzt). Ungültiges wirft und wird nicht gespeichert.
- Der TV baut den QR aus `joinUrl` (Fallback `location.origin`), rendert ihn neu,
  sobald sich die Adresse ändert; der QR-Rahmen ist bewusst **nicht** abgerundet.
- Admin bekommt dafür ein Feld „QR-Adresse" über der Nutzerliste.

**TV-Layout (kein Architektur-, nur UI-Feinschliff, hier der Vollständigkeit
halber):** Podest deutlich kompakter (Höhen/Schriftgrößen reduziert); unter dem
Podest maximal 5 Plätze gleichzeitig, bei mehr rotiert das Fenster alle 4,5 s um
eine Position nach oben; zwischen Tabelle und Footer ein Fun-Facts-Band als
Platzhalter (später echte Statistiken wie Bier-Rekord/Shot-Meister).

**Begründung:** Der QR muss auf die tatsächliche LAN-Adresse des Pi zeigen
können, ohne Code-Änderung — daher einstellbar und persistent. Die Rotation hält
auch bei vielen Gästen die Liste lesbar, ohne dass das Podest Platz verschwendet.
Kein Build-Step, keine neuen Dependencies (D-007).

## 2026-07-15 · D-011: Dunkles „Liquid Glass" statt brauner Flächen (experimentell)

**Entscheidung (auf Nutzerwunsch zum Ausprobieren):** Die braunen Oberflächen
(Design-Tokens mit Hue 55) werden durch dunkles Glassmorphism ersetzt. Die
`--surface`-Tokens sind jetzt halbtransparent und leicht grünstichig
(Hue 160, Alpha 0.55–0.68 = „relativ dunkel, relativ undurchsichtig"). Eine
Utility-Klasse `.glass` (plus direkte Anwendung an `.card`, `.field`, Podest,
Nutzer-/Admin-Zeilen, Modals, Fun-Facts-Band) ergänzt `backdrop-filter: blur(16px)`
und eine feine helle Glaskante (`--glass-edge`). Farbige Aktions-Elemente
(Bier-/Shot-/Grün-Buttons, Podest-Badges) bleiben bewusst kräftig.

**Begründung:** Der Nutzer möchte die Optik testen; Braun gefiel noch nicht.
Reine CSS-Änderung, offline (D-007), keine neuen Dependencies. `backdrop-filter`
wird von Chromium (Pi-Kiosk) unterstützt; ohne Unterstützung bleibt die Fläche
einfach dunkel-transluzent. Kann bei Nichtgefallen leicht zurückgedreht werden.

## 2026-07-15 · D-012: Drittes Getränk „Mischen" + TV-Feinschliff, Live-Fun-Facts, grüner Glas-Rand

**Entscheidung (auf Nutzerwunsch):**

- **Drittes Getränk „Mischen"** (Code-Bezeichner `mix`, Spalte `players.mixes`,
  Log-Wert `'mix'`). Zieht sich durch alle Ebenen: DB, Validierung
  (`increment`/`setCounter` erlauben jetzt `beer|shot|mix`), Nutzer-Dashboard
  (eigene Mischen-Karte), Admin (eigene Mischen-Spalte mit Stepper) und TV
  (Podest-Detailzeile + Ranglisten-Spalte). `total = beers + shots + mixes`.
  Eigene Farbe `--mix` (violett/cocktailhaft), um es klar von Bier (amber) und
  Shots (brick) zu trennen.
- **DB-Migration statt Datenverlust (D-006):** Bestehende Datenbanken werden
  beim Start idempotent nachgezogen — `players.mixes` per `ALTER TABLE`, und
  `drink_log` wird einmalig neu aufgebaut, weil SQLite die alte CHECK-Constraint
  (`drink IN ('beer','shot')`) nicht per ALTER auf `'mix'` erweitern kann. Die
  vorhandenen Log-Einträge und Einstellungen (`join_url`) bleiben erhalten.
- **Fun-Facts jetzt live** statt Platzhalter: berechnet aus dem State die
  Tages-Bestleistungen (Bier-König / Shot-Meister / Misch-Meister des Abends je
  nach höchstem Heute-Wert) plus „Fleißigste:r heute" (meiste Getränke gesamt).
  Ohne Getränke heute erscheint ein Fallback-Text. Kein neuer Server-Endpunkt —
  „Heute"-Werte kommen ohnehin aggregiert aus `getState()`.
- **Rangliste ab Platz 4 scrollt jetzt endlich (nicht mehr endlos rotierend):**
  max. 5 sichtbar; bei mehr wandert das Fenster Zeile für Zeile nach unten und
  springt am Ende **schnell zurück nach oben**, dann von vorne. Umsetzung per
  `translateY` auf einem Track im Viewport (kein Framework, reines CSS/JS).
- **Podest-Überlappung behoben:** die Rang-Badges (1/2/3) ragten in den Namen;
  die Karten haben nun mehr Kopf-Abstand (padding-top), Zahl/Name überschneiden
  sich nicht mehr.
- **Tabellen als großes gerundetes Panel:** TV-Rangliste und Admin-Liste liegen
  in einem `--radius-lg`-Panel, die einzelnen Zeilen sind eigenständig
  abgerundet (`--radius`) mit Lücke — statt flacher Trennlinien.
- **Wasserzeichen zurück nach rechts:** der große Zapfen auf dem TV sitzt wieder
  rechts (vom Nutzer bevorzugt), nicht mehr mittig.
- **Test: dünner dunkelgrüner Glas-Rand.** `--glass-edge` ist von der hellen
  Kante (oklch 0.92/0.12) auf ein dezentes Dunkelgrün (oklch 0.52 0.11 150 / 0.60)
  umgestellt — passend zum Glassmorphism, wirkt auf alle `.glass`-Elemente.
  Reine Token-Änderung, leicht zurückdrehbar.

**Begründung:** Alles vom Nutzer angefordert. Keine neuen Dependencies, offline
(D-007), Persistenz gewahrt (D-006). Die Fun-Facts erfüllen den in D-010
angekündigten „echte Statistiken"-Platzhalter.

## 2026-07-15 · D-013: Reset-Passwort, Scoreboard-Sichtbarkeit, TV-Modus, Lebendigkeit

**Entscheidung (auf Nutzerwunsch):**

- **Komplett-Reset braucht das Admin-Passwort.** Das „Gedrückt halten"-Muster
  ist durch ein Modal ersetzt, in dem das Admin-Passwort (dieselbe `.env` wie der
  Login, D-003) erneut eingegeben werden muss. Der Server prüft es im `reset`-
  Handler gegen `config.adminPassword`; ohne korrektes Passwort passiert nichts.
- **Sichtbarkeit pro Nutzer im Scoreboard.** Neue Spalte `players.hidden`
  (Migration für bestehende DBs, D-006). Ein Haken je Zeile im Admin schaltet
  `setHidden` (admin-only). Der TV **filtert** verborgene Spieler komplett heraus
  und **rankt die sichtbaren neu** (Teilnehmerzahl, Summen und Fun-Facts zählen
  nur Sichtbare). Dashboard/Login bleiben unberührt – „hidden" betrifft nur den TV.
- **TV-Ansicht umschaltbar: All-Time ↔ Heute.** Neue Einstellung `board_mode`
  (`settings`-Tabelle, Default `alltime`), nur im Admin umschaltbar (kein
  Auto-Wechsel). Der TV rechnet die Spalten/Podest-Werte je Modus (All-Time =
  Gesamtzähler, Heute = Party-Tag-Werte) und sortiert/rankt entsprechend neu.
  Beim Wechsel fährt das ganze Board seitlich raus und wieder rein (CSS-Transition
  auf `#board`); Kopf, Fun-Fact und Wald-Footer bleiben stehen.
- **Grüner Glas-Rand zurückgenommen.** Der Test aus D-012 (dunkelgrüne
  `--glass-edge`) gefiel nicht → zurück auf die feine helle Glaskante
  (oklch 0.92 0.02 160 / 0.12).
- **Mehr Lebendigkeit (reines CSS/JS):** jeder Button sinkt beim Drücken leicht ein
  (`:active` scale), Zähler „ploppen" beim Hochzählen (`pk-pop`), Podest-Zahlen
  poppen bei Anstieg und leuchten kurz auf, wenn ein anderer Mensch den Platz
  übernimmt (`pk-flash`). `prefers-reduced-motion` schaltet die Keyframes ab.
- **Dashboard-Logo größer** (34 → 80 px).
- **Fun-Facts-Band schlanker, Wald-Footer höher** (70 → 96 px), damit die Bäume
  frei bleiben und nicht vom Band verdeckt wirken.

**Begründung:** Alles vom Nutzer angefordert. Keine neuen Dependencies, offline
(D-007), Persistenz und Migrationen gewahrt (D-006). Der Board-Modus ist bewusst
nur manuell (Admin) – ein Auto-Wechsel kann später ergänzt werden.

## 2026-07-15 · D-014: Tabellen-Animation, Rekord-Fun-Facts, getrenntes Lösch-Passwort, Admin-Sortierung, QR-Kasten

**Entscheidung (auf Nutzerwunsch):**

- **Animationen auch in der TV-Rangliste.** Das Rendern der Liste ab Platz 4 ist
  jetzt diff-basiert: bei gleicher Reihenfolge werden die Werte in den vorhandenen
  Zeilen aktualisiert (Scrollposition bleibt erhalten), gestiegene Zähler „poppen"
  und die Zeile leuchtet kurz gold auf. Ändert sich die Reihenfolge, wird neu
  aufgebaut und die Zeilen gleiten per **FLIP** von ihrer alten an die neue
  Position (neue Zeilen blenden ein). `prefers-reduced-motion` schaltet das ab.
- **Fun-Facts mit All-Time-Tagesrekorden**, schön ausformuliert, z. B. „Bier-Rekord:
  Die meisten Biere an einem Abend hat Jonas am 25.09.2025 geschafft – ganze 13
  Stück." Serverseitig neu: `getRecords()` bildet je Sorte den (Spieler, Party-Tag)
  mit den meisten Getränken aus `drink_log` (Party-Tag-Grenze 06:00 in SQL über
  `date((ts/1000)-21600,'unixepoch','localtime')`). Ausgeblendete Spieler zählen
  nicht. Die Rekorde stehen im State (`records`) und rotieren mit den bisherigen
  Tages-Bestleistungen im Fun-Fact-Band.
- **Eigenes Lösch-Passwort** (`RESET_PASSWORD`), getrennt vom Admin-Login. Der
  `reset`-Handler prüft gegen `config.resetPassword`. Ist `RESET_PASSWORD` nicht
  gesetzt, gilt weiter `ADMIN_PASSWORD` (Backward-Compat). In `.env.example`
  dokumentiert; das Reset-Modal fragt jetzt das „Lösch-Passwort" ab.
- **Admin-Liste alphabetisch nach Name** sortiert (nicht mehr nach Punktestand),
  damit Nutzer beim Verwalten leichter zu finden sind. Betrifft nur die Admin-
  Ansicht; TV/Rangliste bleiben nach Punkten sortiert.
- **Glassmorphism-Kasten um QR-Code** und „Scan zum Beitreten" auf dem TV (Test).

**Begründung:** Alles vom Nutzer angefordert. Keine neuen Dependencies, offline
(D-007), Persistenz gewahrt (D-006). `getRecords()` läuft pro State-Broadcast über
das Log – bei Party-Größe vernachlässigbar; bei Bedarf später cachebar.

## 2026-07-16 · D-015: TV-Rotation einstellbar, eigene Fun-Facts, Heute-Filter, Abend-Archiv, persönliche Statistik + Achievements, PWA, Login-Rate-Limit

**Entscheidung (auf Nutzerwunsch):**

- **Rotationsgeschwindigkeit der TV-Rangliste im Admin einstellbar.** Neuer
  Settings-Key `scroll_seconds` (Verweildauer pro Scroll-Schritt, Default 3,2 s),
  WS-Handler `setScrollSpeed` (Admin, 1–30 s), Regler in der TV-Anzeige-Leiste
  des Admin-Dashboards. Der TV übernimmt Änderungen live (laufender Takt wird
  neu gestartet). Zeilenhöhe richtet sich jetzt immer am 5er-Raster aus, damit
  wenige Zeilen (Heute-Ansicht) nicht gestreckt werden.
- **Eigene Fun-Facts/Meldungen** (Titel + Text) in neuer Tabelle `facts`
  (`CREATE TABLE IF NOT EXISTS` → migrationssicher). WS-Handler `addFact` /
  `deleteFact` (Admin; Titel 1–30, Text 1–160 Zeichen, max. 50 Meldungen),
  Pflege im Admin-Dashboard. Das TV-Band zeigt jetzt je Eintrag Titel + Text;
  eigene Meldungen rotieren mit den berechneten Facts.
- **„Heute"-Ansicht zeigt nur, wer heute geloggt hat.** Der Sichtbarkeits-Haken
  im Admin gilt nur noch für die Gesamtansicht (All-Time); die Tagesliste
  filtert automatisch auf Spieler mit mindestens einem Getränk am laufenden
  Party-Tag (Kopfzeile: „N heute dabei").
- **Abend-Archiv unter `/abende`** (`public/abende.html`, `GET /api/archive`,
  serverseitig `getArchive()`): jeder Party-Tag als Karte mit Wochentag/Datum,
  Sieger (👑 + Getränkezahl), Teilnehmerzahl und Gesamtmengen je Sorte.
  Verlinkt von Login- und Dashboard-Fußzeile.
- **Persönliche Statistik im Nutzer-Dashboard** (`GET /api/players/:id/stats`,
  serverseitig `getPlayerStats()`): Anzahl eigener Abende, bestes Ergebnis
  (mit Datum), Verteilungsbalken Bier/Shots/Mischen (aus den All-Time-Zählern).
  Wird bei jedem neuen Log-Ereignis nachgeladen (State-Broadcast als Trigger).
- **Achievements als Badges** (auf den laufenden Party-Tag bezogen, im selben
  Endpoint): 🥇 Erster Trinker (erstes Log des Abends), 🌙 Mitternachtsbier
  (Bier zwischen 00:00 und 00:59), ⚡ Drei in einer Stunde (drei Logs binnen
  60 min), 🍹 Mischmeister (≥ 3 Mischen heute). Verdiente Badges leuchten gold,
  offene sind gedimmt.
- **PWA:** `manifest.webmanifest` (Name, Standalone, `#010f05` als Theme-Farbe
  = exakter sRGB-Wert von `--bg`), Icons 192/512 px aus dem Logo gerendert
  (`assets/icon-192/512.png`, maskable-tauglich), `theme-color`/
  `apple-touch-icon` auf allen Seiten. Dazu ein **bewusst cache-freier**
  Mini-Service-Worker (`sw.js`, fetch-Handler ohne `respondWith`): macht die
  App auch auf älteren Android-Chromes installierbar, liefert aber nie
  veraltete Dateien aus (wichtig für Updates auf dem Pi, D-006).
- **Rate-Limit auf Logins** (`server/ratelimit.js`, ohne neue Dependency):
  pro IP werden Fehlversuche gezählt; nach 5 Fehlversuchen binnen 1 min sind
  `POST /api/login` und `POST /api/admin/login` für 5 min gesperrt (HTTP 429
  mit Restzeit). Erfolgreicher Login setzt zurück. In-Memory reicht (ein
  Prozess, LAN); ein Neustart hebt Sperren auf.

**Begründung:** Alles vom Nutzer angefordert. Keine neuen npm-Dependencies,
offline-fähig (D-007: Icons/Manifest liegen in `public/`), Persistenz gewahrt
(D-006: nur additive Schema-Änderung per `CREATE TABLE IF NOT EXISTS`).
Rate-Limit schützt die 4-stelligen PINs (10 000 Kombinationen) gegen
Durchprobieren, ohne legitime Gäste zu stören.

## 2026-07-16 · D-016: Fun-Fact-Wechseltakt im Admin einstellbar

**Entscheidung (auf Nutzerwunsch):** Der Wechseltakt des Fun-Fact-Bands am TV
ist jetzt im Admin-Dashboard einstellbar – kürzeste Stufe **30 Sekunden**,
längste **5 Minuten (300 s)**. Neuer Settings-Key `funfact_seconds` (Default
30 s), WS-Handler `setFunfactSpeed` (Admin, 30–300 s, serverseitig geprüft),
zweiter Regler in der TV-Anzeige-Leiste neben dem Ranglisten-Tempo. Der TV
liest `funfactSeconds` aus dem State und startet den Rotations-Timer bei
Änderung neu (übernimmt also live). Das bisherige feste 7-Sekunden-Intervall
entfällt.

**Begründung:** Vom Nutzer angefordert; analog zu D-015 (`scroll_seconds`)
umgesetzt. Keine neuen Dependencies, offline-fähig, Persistenz gewahrt (Setting
überlebt den Neustart). 30 s als Untergrenze verhindert hektisches Flackern,
5 min als Obergrenze lässt eine Meldung lange stehen.

## 2026-07-16 · D-017: Missbrauchsschutz – Kontoerstellung-Limit und Increment-Throttle

**Entscheidung (nach Security-Review):** Zwei Missbrauchspunkte der offenen
Party-App gehärtet, ohne echte Gäste zu stören:

- **Kontoerstellung gedrosselt und gedeckelt.** `POST /api/players` ist bewusst
  ohne Login (Gäste melden sich selbst an, D-002), war aber unbegrenzt. Jetzt:
  max. 6 neue Konten pro Minute und IP (`createRateLimiter` in
  `server/ratelimit.js`, zählt jeden Versuch im gleitenden Fenster → HTTP 429)
  plus harter Gesamt-Deckel `MAX_PLAYERS = 200`. Verhindert Massen-Anlage/
  DB-Spam durch ein Skript.
- **Spieler-Increments gedrosselt.** Ein Spieler durfte sein „+1" beliebig
  schnell senden (Zähler-/Log-Flut, Broadcast-Sturm zu allen TVs). Jetzt
  Token-Bucket **pro Spieler** (`auth.sub`, nicht pro Verbindung – Neu-Verbinden
  hebelt den Schutz nicht aus): im Schnitt ~1 Getränk/Sekunde, kurzer Burst bis
  5. Admins bleiben ungedrosselt (Korrekturen, D-004).

**Bewusst NICHT geändert (Design-Kompromisse der LAN-App):** 4-stellige PINs
und die öffentliche `/api/state` (fürs Scoreboard) bleiben – das Rate-Limit auf
den Logins (D-015, 5 Fehlversuche/min → 60 s Sperre) bremst PIN-Raten
ausreichend; Klartext-HTTP im WLAN bleibt (kein TLS auf dem Kiosk-Pi).

**Begründung:** Beides vom Nutzer nach dem Review gewünscht. Keine neuen
Dependencies, In-Memory (ein Prozess, LAN), Persistenz unberührt. Verifiziert:
7. Konto in einer Minute → 429; 20 schnelle Spieler-Increments → nur 5 durch,
Rest gedrosselt; Neu-Verbinden setzt den Bucket nicht zurück; Admin
ungedrosselt; Bucket füllt sich über die Zeit nach.

## 2026-07-16 · D-018: PIN wieder optional pro Nutzer (ersetzt D-002)

**Entscheidung (auf Nutzerwunsch):** Die 4-stellige Nutzer-PIN ist wieder
**optional** – pro Konto. Das kehrt die frühere Verpflichtung aus **D-002**
bewusst um und entspricht wieder dem ursprünglichen Design-Prototyp
(„PIN (optional)"). D-002 bleibt als historischer Eintrag stehen und gilt ab
hier als überholt.

**Umsetzung:**
- Beim Anlegen (Login-Seite und Admin) ist das PIN-Feld optional. Leer =
  Konto ohne PIN. In der DB wird dafür `pin_hash = ''` gespeichert (leerer
  String als „keine PIN"); **keine Schema-Migration nötig**, die Spalte bleibt
  `NOT NULL`. Bestehende Konten mit PIN sind unberührt.
- Login: Konten **ohne** PIN werden durch Antippen des Namens **direkt**
  angemeldet (kein Eingabefeld). Konten **mit** PIN verlangen sie wie bisher;
  falsche/fehlende PIN → 401. Das Login-Rate-Limit (D-015) bleibt aktiv.
- Der State liefert pro Spieler `hasPin` (nur der Boolean, **nie** der Hash),
  damit die Login-Seite direkt-anmelden vs. abfragen unterscheiden kann und der
  Admin PIN-lose Konten markiert („ohne PIN").
- Admin kann per PIN-Modal eine PIN setzen **oder entfernen** (leeres Feld).

**Sicherheits-Hinweis (bewusst akzeptiert):** Ein Konto **ohne** PIN ist nicht
geschützt – wer den Namen antippt, ist als diese Person angemeldet und kann
deren Zähler erhöhen / das Dashboard sehen. Für eine lockere Partyrunde
gewollt; wer Schutz will, vergibt eine PIN. Admin-Login, Lösch-Passwort und
alle Server-seitigen Rollenprüfungen (D-004) sind davon **nicht** betroffen.

**Begründung:** Vom Nutzer gewünscht, entspricht dem Original-Design. Keine
neuen Dependencies, keine Migration, Persistenz gewahrt (D-006). Verifiziert:
Anlegen/Login ohne PIN klappt, PIN-Konten und Bestandsnutzer bleiben geschützt,
Admin kann PIN setzen/entfernen, kein Konsolenfehler.

## D-019 (2026-07-17): Zweiter Bereich „Partykeller Youngstars" — getrennte Daten, eigenes Theme

**Entscheidung:** Die App bekommt einen zweiten, eigenständigen Bereich für die
Partykeller **Youngstars** — gleiche Funktionen, aber komplett getrennte Daten,
eigener Admin-Zugang und eigenes Farbkonzept. Ein Node.js-Prozess bedient beide.

**Umsetzung:**
- **URL-Bereiche:** `/partykeller/*` und `/youngstars/*`; `/` ist eine
  vorgeschaltete **Auswahlseite** mit beiden Logos (`start.html`). Alt-Pfade
  (`/tv`, `/dashboard`, `/admin`, `/abende`) leiten auf den Partykeller um,
  `/api/*` und `/ws` bleiben als Partykeller-Alias — nichts Bestehendes bricht.
- **Datentrennung:** `server/db.js` ist jetzt eine Factory (`createDb`); je
  Bereich eine eigene SQLite-Datei (`data/partykeller.db`, `data/youngstars.db`)
  mit identischem Schema. Nutzer, Logs, Settings, Fun-Facts und Archiv können
  sich nie vermischen.
- **Auth:** Tokens tragen einen **Bereichs-Stempel** (`area`); ein
  Partykeller-Token gilt nicht im Youngstars-Bereich und umgekehrt (auch für
  Admins). Alt-Tokens ohne Stempel gelten als Partykeller (niemand fliegt beim
  Update raus). Youngstars-Admin: **`YOUNGSTARS_ADMIN_PASSWORD`** (Pflicht in
  der .env). Das **Lösch-Passwort bleibt gemeinsam** (`RESET_PASSWORD`), der
  Reset löscht aber immer nur den Bereich, in dem er ausgelöst wurde.
- **Frontend:** Dieselben HTML-Dateien bedienen beide Bereiche.
  `public/js/area.js` erkennt den Bereich am URL-Präfix und steuert API-/WS-
  Präfix, getrennte Storage-Keys (`pk_*`/`ys_*`) und das Theme über
  `html[data-area]`. WS-Endpunkte: `/partykeller/ws`, `/youngstars/ws`.
- **Getränke:** unverändert Bier/Shots/Mischen — aber im Youngstars-Dashboard
  steht **Bier ganz unten** (Reihenfolge Shots, Mischen, Bier). Kein Aperol
  (zunächst angedacht, vom Nutzer wieder verworfen).
- **Theme Youngstars:** dunkles **Navyblau** statt Dunkelgrün, Akzente in
  **Orange** (am Neon-Logo orientiert), Shots in einem **Pinkton** aus den
  Glut-Tönen des Logos; Zapfen-Hintergrund als hellere Navy-Variante
  (`zapfen-bg-navy.svg`); **kein Baum-Footer**. Neben dem Partykeller-Logo
  steht das Youngstars-Neon-PNG (`assets/youngstars-logo.png`; aktuell eine
  programmatisch freigestellte Übergangsversion, wird durch die Original-Datei
  des Nutzers ersetzt).
- **PWA:** eigenes Manifest (`manifest-youngstars.webmanifest`, start_url
  `/youngstars/`) mit eigenen Orange-Icons; das Partykeller-Manifest zeigt
  jetzt auf `/partykeller/` — beide Apps können nebeneinander installiert sein.

**Begründung:** Youngstars brauchen eine eigene Rangliste ohne Datenvermischung
mit dem Partykeller. Ein Prozess + zwei DB-Dateien hält den Pi-Betrieb simpel
(keine zweite Instanz, kein zweiter Port) und erfüllt die harte
Ein-Prozess-Regel; gemeinsame HTML/JS-Dateien vermeiden doppelte Pflege.

## D-020 (2026-08-16): Tiebreak bei Punktegleichstand = Uhrzeit statt Name

**Entscheidung:** Stehen zwei Spieler:innen beim Gesamtwert (Bier+Shots+Mischen)
gleichauf, entscheidet künftig, wer **zuerst** auf diesen Stand kam (Zeitpunkt
des jeweils letzten geloggten Getränks, aufsteigend). Alphabetisch nach Name
ist nur noch der letzte Fallback, falls auch dazu kein Log-Eintrag existiert
(z. B. reine Admin-Korrektur ohne organischen Trink-Eintrag). Betrifft die
Rangliste server-seitig (`getState()` in `server/db.js`, u. a. für die
Rang-Anzeige im Nutzer-Dashboard) sowie das TV-Board (`public/tv.html`, beide
Modi All-Time/Heute). Dafür neue Abfragen `lastLogTs`/`lastLogTsToday`
(`MAX(ts)` je Spieler:in aus `drink_log`), keine Schemaänderung.

**Begründung:** Vom Nutzer gewünscht. Passt zum Charakter eines
Trinkspiel-Wettbewerbs ("wer war zuerst dran"); Namensalphabet als Tiebreak
wirkte willkürlich. Keine neuen Dependencies, `drink_log` trug die nötigen
Zeitstempel bereits.

## D-021 (2026-08-26): TV-Board auf feste Design-Bühne skaliert, Rotation an feste Zeilenhöhe gekoppelt

**Entscheidung:** Das TV-Scoreboard wird auf eine feste **Design-Bühne**
(1080 Design-Pixel Höhe, Breite fluid ab 1440) gelayoutet und als Ganzes per
`transform: scale()` auf die echte Fenstergröße skaliert (`.stage` +
`fitStage()` in `public/tv.html`). Die Ranglisten-Zeilen haben eine **feste
Zeilenhöhe** (64 px im Design-Raster); wie viele Zeilen sichtbar sind, ergibt
sich aus dem Platz — die Rotation (`syncScroll()`) berechnet Sichtfenster und
Endposition bei jeder Größenänderung neu und blendet die angeschnittene Zeile
unten weich aus (mask-image).

**Begründung:** Im Praxistest (Laptop, Win11/Chrome, kleinere effektive
Auflösung durch 125-%-Skalierung) zerquetschten die bisher festen Pixelmaße
von Kopfzeile/Podest die Tabelle: Zeilenhöhe wurde aus dem Restplatz durch 5
geteilt, Zeilen überlappten, die Rotation lief gegen falsche Grenzen. Mit der
skalierten Bühne sieht das Board auf **jeder Auflösung exakt gleich** aus
(Wunsch-Referenz „Beispiel-gut"), die Tabelle bekommt allen Restplatz, und die
Rotation hängt nicht mehr von gemessenen Pixelhöhen ab (auch der späte
Font-Swap kann nichts mehr verschieben).

## D-022 (2026-08-26): Abend-Archiv nachträglich korrigierbar + Archiv-Abend auf dem TV

**Entscheidung:** Admins können vergangene Party-Tage korrigieren und wieder
anzeigen:
- **Korrektur** (`adjustArchive` über WS, `db.adjustArchiveDrink`): ±1 Getränk
  je Spieler/Sorte/Party-Tag. Wirkt in einer Transaktion auf **drink_log UND
  den All-Time-Zähler** — beim Entfernen fliegt der jüngste Log-Eintrag der
  Sorte in dem Party-Tag raus, beim Ergänzen wird ein Eintrag hinter das letzte
  Getränk des Spielers an dem Abend gelegt (sonst 20:00). Damit bleiben
  Rangliste, Rekorde, Abzeichen und Archiv konsistent. UI: „Bearbeiten"-Modal
  auf `/abende` (alle Spieler, auch mit 0 — Nachtragen möglich), sichtbar nur
  mit Admin-Login derselben Browser-Session.
- **Archiv-Replay:** `setBoardMode` kennt neben `alltime`/`today` jetzt
  `archive` + `board_day`; der State liefert dann die fertig sortierten Werte
  des Tages (`archivePlayers`), das TV zeigt „Abend vom …". Umschaltbar im
  Admin (Auswahlliste) und direkt auf den Archiv-Karten („Auf dem TV zeigen").
- Neuer REST-Endpunkt `GET /api/archive/:day` (Tagesdetail); der
  Archiv-Sieger nutzt jetzt ebenfalls den D-020-Tiebreak (Uhrzeit statt
  Map-Reihenfolge).

**Begründung:** In der Testwoche wurden Getränke vergessen oder falsch
gezählt; Korrekturen sollen gezielt am betroffenen Abend passieren statt nur
am All-Time-Zähler (der Log ist die Quelle für Archiv/Rekorde/Abzeichen).
Vergangene Abende nochmal zeigen zu können war ausdrücklicher Wunsch.

## D-023 (2026-08-26): Profil-Tab im Dashboard, Abzeichen-Zähler, Tagessieger-Abzeichen, Statistik-Fun-Facts

**Entscheidung:**
- Das Nutzer-Dashboard bekommt einen Umschalter **„Zählen" / „Profil"**: Zählen
  enthält nur noch die Eingabe (Heute-Karte + drei Getränke-Karten), das Profil
  bündelt Statistik: Stand heute (Platz, wer direkt **vor/hinter** einem liegt,
  inkl. Abstand; „gleichauf" bei Gleichstand), All-Time-Stand mit Umfeld,
  persönliche Statistik (Abende, bestes Ergebnis, **Ø pro Abend**, Verteilung)
  und die Abzeichen.
- **Abzeichen** werden jetzt **pro Party-Tag über alle Abende gezählt**
  (`getPlayerStats` liefert `{count, today}` je Abzeichen) statt nur „heute
  geschafft ja/nein". Neues Abzeichen **👑 Tagessieger** (Gesamt-Tagessieger
  des Abends, heute = führt aktuell; Tiebreak D-020 über `getDayWinners`).
- Das Fun-Fact-Band speist sich zusätzlich aus neuen Server-Kennzahlen
  (`funStats` im State): Rekord-Abend (alle zusammen), Stammgast (meiste
  Abende), Seriensieger (meiste Tagessiege), Frühstart (erstes Getränk heute),
  durstigste Stunde heute, Gesamtbilanz über alle Abende.
- Eigene Fun-Facts sind **bearbeitbar** (`updateFact` über WS, Inline-Formular
  im Admin).

**Begründung:** Wunsch aus der Testwoche: Statistik raus aus dem Eingabefluss
auf eine eigene Profil-Seite, mehr Kontext („wer ist vor/hinter mir"),
sichtbare Abzeichen-Historie, ein Abzeichen für den Tagessieg und mehr
abwechslungsreiche Fun-Facts aus echten Daten. Alles aus `drink_log`
berechenbar — keine Schemaänderung, keine neuen Dependencies.

## D-024 (2026-08-26): Rekordkurs (Bier-Pace) live auf dem TV

**Entscheidung:** Der State enthält `funStats.pace`: Getränke des laufenden
Abends (sichtbare Spieler) im Vergleich zum besten **bisherigen** Abend zum
**gleichen Zeitpunkt** (gleiche Zeitspanne seit dem 06:00-Start, gezählt über
`drink_log`). Liegt der Abend vorn (`onPace`, ab 3 Getränken), zeigt das TV
eine glühende Pill im Kopfbereich („🔥 Auf Rekordkurs! 34 : 28 vs. 22.08.2026")
plus einen Fun-Fact; im Archiv-Modus ist sie ausgeblendet. Da der Vergleich
zwischen zwei Getränken altert (der Rekord-Abend „zieht weiter"), holt sich
das TV den Pace-Stand zusätzlich alle 5 Minuten per REST — der übrige State
läuft unverändert über die WS-Broadcasts.

**Begründung:** Nutzerwunsch (aus den Vorschlägen bestätigt): Live-Spannung
auf dem Board, ob der Abend den Rekord knackt. Der laufende Abend wird bewusst
gegen den besten *vergangenen* Abend verglichen (sonst wäre der Rekord-Abend
irgendwann er selbst und die Anzeige sinnlos). Keine Schemaänderung, eine
zusätzliche COUNT-Abfrage.

## D-025 (2026-08-31): CSV-Übergabedateien im Abend-Archiv

**Entscheidung:** `/abende` bietet Downloads im **Langformat** an — je eine
Zeile pro Party-Tag und Person mit den Spalten
`Tag;Datum;Wochentag;Name;Bier;Shots;Mischen;Gesamt`. Zwei Leseendpunkte je
Bereich: `GET <base>/api/export/archive` (alle Abende, Datei
`<bereich>-abende-gesamt.csv`) und `GET <base>/api/export/archive/:day` (ein
Abend, `<bereich>-abend-<tag>.csv`). Der Server erzeugt die Datei und liefert
sie per `Content-Disposition: attachment`.

Formatentscheidungen (`server/csv.js`): **Semikolon** als Trennzeichen,
**CRLF** und ein **UTF-8-BOM**, damit ein deutsches Excel die Datei per
Doppelklick korrekt und mit intakten Umlauten öffnet. `Tag` ist zusätzlich in
ISO-Form (`2026-08-22`) dabei, damit die Datei auch maschinell sortierbar ist.
**Keine Summenzeile** — die Datei bleibt eine saubere Tabelle und ist direkt
als Pivot auswertbar. Zellen, die mit `= + - @` beginnen, werden mit einem
vorangestellten `'` entschärft (Namen kommen von Gästen, Excel würde sie sonst
als Formel ausführen). Personen ohne Getränke an dem Abend fallen raus,
ausgeblendete Personen sind dabei — wie in den Tagessummen des Archivs.

Die Endpunkte sind **ohne Login** erreichbar, genau wie `/archive` und
`/archive/:day`, aus denen sie sich speisen. Der CSV-Knopf je Abend und
„Alle Abende als CSV" sind deshalb für alle sichtbar; Bearbeiten und „Auf dem
TV zeigen" bleiben Admin-only.

**Begründung:** Nutzerwunsch: eine Übergabedatei, die sich auswerten lässt —
pro Abend oder gesamt. CSV im Langformat ist das, was Excel/LibreOffice ohne
Zwischenschritt einlesen und pivotieren; serverseitig erzeugt spart es
Blob-Bastelei im Frontend und liefert einen echten Dateinamen. Keine neuen
Dependencies, keine Schemaänderung.

## D-026 (2026-08-31): Fun-Fact-Band auf dem TV ist eine Zeile hoch

**Entscheidung:** Das Fun-Fact-Band auf dem TV ist **exakt so hoch wie eine
Ranglistenzeile** (64 Design-Pixel, `ROW_H`) und der Fact-Text steht in
**Namensgröße** (28 px, wie `.col-name`); die Überschrift „Fun Fact" bei
18 px. Das Band bleibt einzeilig: Passt ein Fact nicht in die Breite, skaliert
`fitFactText()` die Schrift proportional herunter (Untergrenze 15 px, darunter
schneidet `text-overflow: ellipsis` ab). Neu gemessen wird bei jedem
Fact-Wechsel, bei `resize` und wenn der Webfont fertig geladen ist.

**Begründung:** Das Band war mit 14 px Text vom Sofa aus praktisch nicht mehr
lesbar (Gegenentscheidung zur Verkleinerung aus #16, die Platz für die
Rangliste schaffen sollte). Eine Ranglistenzeile als Maß hält es optisch im
Raster des Boards und kostet nur ~30 Design-Pixel, also weniger als eine
Tabellenzeile — bei 1080p bleiben 11 sichtbare Ränge. Das Herunterskalieren
statt Umbrechen hält die Bühnenhöhe stabil, sodass die Rangliste nicht bei
jedem Fact-Wechsel springt.

## D-027 (2026-08-31): CSV-Export nur für Admins

**Entscheidung:** Die Übergabedateien aus dem Abend-Archiv sind nur noch mit
Admin-Login erreichbar — genau wie „Bearbeiten" und „Auf dem TV zeigen". Das
gilt auf beiden Ebenen: die Knöpfe „⬇ CSV" und „⬇ Alle Abende als CSV"
erscheinen nur mit Admin-Token in der Browser-Session, und
`GET <base>/api/export/archive[/:day]` antwortet ohne gültiges Admin-Token
dieses Bereichs mit **403**. Ein Spieler-Token oder ein Admin-Token des anderen
Bereichs reicht nicht (D-019).

Weil ein einfacher `<a href download>` keinen Authorization-Header mitschicken
kann, holt die Archiv-Seite die Datei jetzt per `fetch` mit
`Authorization: Bearer <token>` und speichert den Blob über einen erzeugten
Klick-Link. Das Token bleibt damit aus URL, Browser-Verlauf und Server-Logs
heraus — anders als bei einem Query-Parameter. Fehlschläge (abgelaufenes
Token, Netzwerk) zeigt ein kleiner Toast, der auch ohne offenes
Bearbeiten-Modal sichtbar ist. Ersetzt die Freigabe aus D-025.

**Begründung:** Nutzerwunsch. Die Kartenansicht des Archivs (Sieger,
Teilnehmerzahl, Tagessummen) bleibt für alle offen, aber die namentliche
Aufschlüsselung „wer hat an welchem Abend wie viel getrunken" als Datei zum
Mitnehmen ist etwas anderes als eine Zahl auf dem Bildschirm — das gehört
hinter denselben Zugang wie die Archiv-Korrektur.

## D-028 (2026-09-01): Abende im Archiv benennen

**Entscheidung:** Jeder Party-Tag kann einen freien Namen bekommen („Saison-
abschluss", „Bierpong-Turnier"). Das Feld steht **im Bearbeiten-Dialog** der
Abend-Karte — also hinter demselben Admin-Zugang wie die Korrekturen und der
CSV-Export (D-027) und für Gäste gar nicht sichtbar. Gespeichert wird als
Zeile in der bestehenden `settings`-Tabelle unter dem Schlüssel
`night_name:<YYYY-MM-DD>`; ein leeres Feld löscht die Zeile wieder. Der Name
erscheint auf der Abend-Karte unter dem Datum und im TV-Titel, wenn der Abend
über „Auf dem TV zeigen" läuft (`Saisonabschluss · 31.08.2026`). Der Server
prüft Tag und Länge (max. 40 Zeichen) wie jede andere Mutation.

**Begründung:** Nutzerwunsch. `settings` statt einer eigenen Tabelle, weil ein
Name genau ein Schlüssel-Wert-Paar ist: keine Migration, keine Fremdschlüssel,
und die Persistenz über Neustarts (D-006) gilt automatisch. Ein Abend ohne
Namen kostet dadurch auch keine Zeile. Die 40 Zeichen sind die Grenze, ab der
der TV-Titel in der Kopfzeile zu breit würde — dort steht er einzeilig mit
Ellipsis, damit die Bühnenhöhe des Boards unverändert bleibt (D-021).

## D-029 (2026-09-01): Verlaufsgraph auf jeder Abend-Karte

**Entscheidung:** Jede Karte im Abend-Archiv zeigt den Verlauf des Abends als
Balken je Stunde — **alle Personen zusammen**, nicht pro Sorte und nicht pro
Person. Der Server liefert ihn im Archiv-Endpunkt gleich mit
(`timeline: { startHour, counts }`), gezählt über `drink_log` gruppiert nach
Party-Tag und Uhr-Stunde. Leere Stunden am Anfang und Ende fallen weg, in der
Mitte bleiben sie als Lücke stehen. Die Spitzenstunde ist golden hervorgehoben
und steht als Text über dem Graphen („Spitze 23 Uhr: 11").

**Begründung:** Nutzerwunsch. Die Werte kommen mit der Liste mit, statt je
Karte einen eigenen Request auszulösen — bei 30 Abenden wären das sonst 30
Anfragen für eine Kleinigkeit. Gezeichnet wird als Inline-SVG mit
`preserveAspectRatio="none"`: kein Chart-Paket (Regel „keine neuen
Dependencies", D-001) und keine Breitenmessung im JS, die Karte skaliert den
Graphen selbst. Stunden statt feinerer Schritte, weil ein Abend so auf 6–10
Balken kommt — auf 280 px Kartenbreite ist das die Auflösung, die man noch
lesen kann.

## D-030 (2026-09-01): Ganze Rangliste im Profil

**Entscheidung:** Die Profil-Karten „Heute Abend" und „All-Time" bekommen je
einen Knopf „Ganze Rangliste ansehen ›". Er öffnet **ein** Blatt, das von
unten hereinfährt, oben zwischen Heute und All-Time umschaltet und die
komplette Liste zeigt: Platz, Name, Gesamt. Die eigene Zeile ist grün
umrandet, mit „(du)" beschriftet und wird beim Öffnen in die Mitte gescrollt.
Die Liste stammt aus demselben State-Broadcast wie die Karten darüber und
läuft live weiter, solange das Blatt offen ist. Schließen per Knopf, Klick auf
den Hintergrund oder Escape.

**Begründung:** Nutzerwunsch — bisher zeigte das Profil nur den eigenen Platz
und die direkten Nachbarn, „wo stehen eigentlich alle?" ging nur über den TV.
Ein Blatt statt einer eigenen Seite, weil der Weg zurück sonst über den
Browser-Zurück-Knopf ginge und die WS-Verbindung neu aufgebaut würde. Ein
gemeinsames Blatt für beide Zeiträume statt zwei Ansichten, weil der Vergleich
„heute vs. insgesamt" genau der Grund ist, aus dem man die Liste aufmacht.
Bewusst dieselbe Sortierung wie in den Karten (inkl. Tiebreak D-020), damit
Platzangabe oben und Liste unten nie auseinanderlaufen.

## D-031 (2026-09-01): Treue-Abzeichen nach Anzahl der Abende

**Entscheidung:** Neues Abzeichen im Profil, das zählt, an wie vielen Abenden
jemand dabei war. Stufen bei **10 (Stammgast), 20 (Dauergast), 50
(Kellerlegende), 100 (Ehrenmitglied) und 200 (Urgestein)**. Angezeigt wird
immer nur die **höchste erreichte** Stufe; unter 10 Abenden erscheint gar
kein Abzeichen. Die Pill zeigt die tatsächliche Zahl der Abende, der Tooltip
die nächste Stufe. Der Server berechnet die Stufe in `getPlayerStats`, das
Frontend zeigt nur an.

**Begründung:** Nutzerwunsch. Die Stufen sind bewusst als „höchste gewinnt"
umgesetzt statt als Reihe von fünf Abzeichen — sonst füllt sich die Zeile mit
Stufen, die man längst hinter sich hat. Kein Abzeichen unterhalb der ersten
Schwelle, damit die Abzeichen-Zeile für neue Gäste nicht mit einem leeren
Platzhalter startet. Anders als die übrigen Abzeichen („leuchtet, wenn heute
geschafft") ist es dauerhaft verdient — der Hinweistext über der Zeile sagt
das jetzt dazu.

## D-032 (2026-09-01): Verlauf als Kurve statt als Balken

**Entscheidung:** Der Verlaufsgraph auf der Abend-Karte ist eine **weiche
Kurve mit gefüllter Fläche** statt der Balkenreihe aus D-029. Die Datenlage
bleibt unverändert (ein Wert je Stunde, alle Personen zusammen); nur die
Darstellung wechselt. Gezeichnet als Catmull-Rom-Kurve, von Hand in kubische
Béziers umgerechnet, mit geklemmten Kontrollpunkten, damit die Kurve bei
starken Sprüngen nicht unter die Grundlinie ausschlägt. Die Spitzenstunde
bekommt eine gestrichelte Markierung bis zur Grundlinie und einen goldenen
Punkt; unsichtbare Streifen je Stunde halten den Tooltip. Ersetzt die
Balkendarstellung aus D-029.

**Begründung:** Nutzerwunsch. Ein Abend hat 5–10 Stunden mit Werten — als
Balken ist das eine Reihe breiter Klötze, als Kurve sieht man den Bogen des
Abends (langsam an, Spitze, Ausklang) auf einen Blick. Zwei Details fallen
dabei an: Die Fläche wird per `preserveAspectRatio="none"` ungleichmäßig auf
die Kartenbreite gezogen, deshalb hängt die Linienstärke an
`vector-effect: non-scaling-stroke` — sonst würde die Linie mitverzerrt. Und
der Punkt auf der Spitze ist ein HTML-Element über der Fläche, weil ein
`<circle>` durch dieselbe Skalierung zur Ellipse würde.

## D-033 (2026-09-01): Ein Knopf für die ganze Rangliste

**Entscheidung:** Statt eines Knopfes in jeder der beiden Profil-Karten
(D-030) steht **ein** Knopf „Ganze Rangliste ansehen ›" allein unter der
All-Time-Karte. Er öffnet das Blatt in der All-Time-Ansicht; auf Heute wird im
Blatt selbst umgeschaltet.

**Begründung:** Nutzerwunsch. Zwei Knöpfe, die dasselbe Blatt öffnen, in dem
ohnehin zwischen beiden Zeiträumen gewechselt wird, sind eine Wiederholung —
und in der Karte sah der Knopf wie ein weiterer Karteninhalt aus. Freistehend
liest er sich als das, was er ist: der Weg aus dem eigenen Umfeld in die
vollständige Liste.

## D-034 (2026-09-01): Vollsicherung als JSON — Download und Import im Admin

**Entscheidung:** Der Admin-Bereich bekommt zwei Knöpfe: **„⬇ Backup
herunterladen"** lädt den kompletten Bereich als eine JSON-Datei
(`GET /<bereich>/api/export/backup`), **„⬆ Backup einspielen"** stellt daraus
alles wieder her (`POST /<bereich>/api/import/backup`). In der Datei stehen
Nutzer inklusive ID, PIN-Hash, Zählern und Sichtbarkeit, das komplette
`drink_log` mit IDs und Zeitstempeln, alle `settings` (TV-Modus, Abend-Namen,
QR-Adresse, Takte) und die eigenen Fun-Facts. Der Import ersetzt den Bestand
des Bereichs vollständig, in **einer Transaktion**, nach einer kompletten
Prüfung in `server/backup.js` — schlägt irgendetwas fehl, bleibt der alte Stand
unverändert. Weil er so destruktiv ist wie „Alles zurücksetzen", verlangt er
dasselbe **Lösch-Passwort** (`RESET_PASSWORD`), hängt am selben Rate-Limit und
ist nur mit Admin-Token des eigenen Bereichs erreichbar; eine Sicherung des
anderen Bereichs (Feld `area`) wird abgewiesen. Format-Kennung
`partykeller-counter-backup`, `version: 1`.

**Begründung:** Nutzerwunsch — bisher hing der ganze Keller an einer
SQLite-Datei auf einem Laptop, und die CSV-Exporte (D-025) sind
Auswertungsdateien, keine Sicherung: ihnen fehlen IDs, PIN-Hashes und
Einstellungen. JSON statt einer Kopie der `.db`, weil die Datei so aus dem
Browser heraus über das Admin-Login geladen werden kann (kein Dateizugriff auf
dem Server nötig), auch bei laufendem Server konsistent ist (WAL-Dateien
einzeln zu kopieren ist es nicht) und beim Einspielen Feld für Feld geprüft
werden kann. IDs wandern bewusst mit: nur dann zeigen alte Links, Abend-Namen
und vor allem die **Tokens auf den Handys** nach der Wiederherstellung wieder
auf dieselben Personen (D-006). Nicht in der Datei steht die `.env` — sie
gehört getrennt gesichert, und nur mit demselben `TOKEN_SECRET` bleiben die
Logins gültig. Der Body-Parser bekommt für diesen einen Endpunkt 20 MB (sonst
100 kB), damit auch ein Log über Jahre durchpasst.

## D-035 (2026-09-01): Erklärtexte an Abzeichen, TV-Anzeige und Fun-Facts entfernt

**Entscheidung:** Die drei beschreibenden Untertitel sind raus: „Leuchtet, wenn
heute geschafft …" unter *Abzeichen* im Profil, „Haken in der Liste gilt nur
für die Gesamtansicht …" im Admin-Block *TV-Anzeige* und „Laufen im TV-Band
zusammen mit den Live-Facts durch." bei *Eigene Fun-Facts*. Die Tooltips an den
einzelnen Abzeichen bleiben.

**Begründung:** Nutzerwunsch. Die Bereiche sind eingeführt und werden von
denselben paar Leuten bedient — der Dauertext erklärt nichts mehr, kostet aber
in jeder Ansicht Platz und Ruhe.
