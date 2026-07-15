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
- `zapfen-bg.svg` — der Rothaus-Zapfen (identische Geometrie wie das frühere
  `zapfen-raw.svg`, vom Nutzer als `gemini-svg` mit Grünfüllung geliefert),
  **fest um 180° gedreht** (Zapfen hängen nach unten). Weil die Drehung nun in
  der Datei steckt, entfielen die kompensierenden `rotate(180deg)` in
  Login/TV/Admin. Als Maske mit `--bg-hi` und niedriger Deckkraft ergibt das
  die gewünschte, „leicht andere Helligkeit" gegenüber dem Rest.
- `cones-flat.png` — als Favicon eingebunden.

**Rundung:** Neue Tokens `--radius` (12px) und `--radius-lg` (18px) ersetzen
die bisherigen 3–4px-Ecken (Karten, Buttons, Felder, Stepper, Podest, QR),
sodass die eckigen Elemente durchgängig leicht abgerundet sind.

**Begründung:** Vom Nutzer angefordert. Alles bleibt offline/vendored
(D-007); keine neuen Dependencies. D-008 ist damit erledigt.
