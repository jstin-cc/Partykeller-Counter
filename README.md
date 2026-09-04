# Getränke-Counter Partykeller 🍺

Gäste zählen ihre Biere und Shots über das Handy, ein Fernseher zeigt die
dauerhafte All-Time-Rangliste. Läuft komplett im lokalen WLAN auf einem
Laptop oder Raspberry Pi — keine Internet-Abhängigkeit.

Es gibt **zwei Bereiche** mit gleichen Funktionen und komplett getrennten
Daten: **Partykeller** (`/partykeller`, dunkelgrün) und **Youngstars**
(`/youngstars`, Navy mit Orange und eigenem Neon-Logo, ohne Baum-Footer).
Die Startseite `/` fragt zuerst, wo gezählt wird. Jeder Bereich hat eigene
Nutzer, Rangliste, Fun-Facts, Archiv, TV-Einstellungen und einen eigenen
Admin-Zugang (Youngstars: `YOUNGSTARS_ADMIN_PASSWORD`).

**Status:** Funktional komplett (M0–M8) — Login, Nutzer-Dashboard,
TV-Scoreboard mit QR-Code und Admin-Bereich laufen live über WebSocket.
Offene Restpunkte in [PROGRESS.md](PROGRESS.md).

## Voraussetzungen

- **Node.js 20 LTS oder neuer** (aktuelles LTS empfohlen). `better-sqlite3`
  bringt dafür fertige Binaries mit — es muss nichts kompiliert werden, keine
  Visual-Studio-Build-Tools nötig.
- **Git**.
- Unter **Windows** muss PowerShell einmalig Skripte erlauben, sonst
  verweigert es `npm` — siehe
  [Windows: `npm` wird von PowerShell blockiert](#windows-npm-wird-von-powershell-blockiert).

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

> Die `.env` muss `ADMIN_PASSWORD`, `YOUNGSTARS_ADMIN_PASSWORD` und
> `TOKEN_SECRET` enthalten (Vorlage: `.env.example`), sonst startet der Server
> bewusst nicht. Ein sicheres `TOKEN_SECRET` erzeugst du z. B. mit
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

### Windows: `npm` wird von PowerShell blockiert

PowerShell verbietet standardmäßig jedes Skript (`Restricted`) — auch das
`npm.ps1`, das hinter dem `npm`-Befehl steckt. Der Fehler sieht so aus:

```
npm : Die Datei "C:\Program Files\nodejs\npm.ps1" kann nicht geladen werden,
da die Ausführung von Skripts auf diesem System deaktiviert ist.
```

Einmalig für den eigenen Benutzer freischalten — **kein Admin nötig**, gilt
dauerhaft für alle künftigen Fenster:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Wenn du nichts dauerhaft ändern willst, reicht das hier — gilt aber nur für
das gerade offene Fenster und muss nach jedem Neustart der Konsole wieder
gesetzt werden:

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

Aktuellen Stand prüfen mit `Get-ExecutionPolicy -List`. Steht bei
`CurrentUser` schon `RemoteSigned`, ist alles erledigt und der Befehl wird
nicht noch einmal gebraucht.

`RemoteSigned` erlaubt lokal erstellte Skripte und verlangt bei aus dem
Internet heruntergeladenen eine gültige Signatur — für eine Entwicklungs-
maschine die übliche Einstellung. In der **Eingabeaufforderung (cmd)** oder im
**Git Bash** tritt das Problem gar nicht auf, dort läuft `npm.cmd` statt
`npm.ps1`.

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

Deine Daten (`data/*.db`) und die `.env` sind gitignored und bleiben
beim Update erhalten. Meldet `git pull` „local changes" und du hast am Code
nichts geändert, hilft `git reset --hard origin/main` — das lässt `data/` und
`.env` unangetastet.

Beschwert sich PowerShell hier über `npm`, siehe
[Windows: `npm` wird von PowerShell blockiert](#windows-npm-wird-von-powershell-blockiert).

> **Update auf die Youngstars-Version (D-019):** Einmalig
> `YOUNGSTARS_ADMIN_PASSWORD=<eigenes Passwort>` in die `.env` eintragen —
> ohne diese Zeile startet der Server nicht (die Fehlermeldung sagt es dir).
> Alles andere läuft weiter wie bisher; alte Links/QR-Codes leiten automatisch
> in den Partykeller-Bereich.

## Screens

Jede Route gibt es einmal pro Bereich — unter `/partykeller/…` und
`/youngstars/…`. Alte Links ohne Präfix (z. B. `/tv`) leiten in den
Partykeller-Bereich.

| Route | Screen |
|---|---|
| `/` | Auswahlseite: Partykeller oder Youngstars? |
| `/<bereich>/` | Nutzer-Login (Name wählen/anlegen; PIN optional, rate-limitiert) |
| `/<bereich>/dashboard` | Nutzer-Dashboard mit zwei Tabs — **Zählen** (eigene Bier-/Shot-/Mischen-Zähler, Heute & Gesamt) und **Profil** (Platz heute und all-time inkl. wer direkt vor/hinter einem liegt, **„Ganze Rangliste ansehen"** als Blatt von unten mit markierter eigener Zeile, Abende, bestes Ergebnis, Ø pro Abend, Verteilung, Abzeichen mit Zähler — u. a. 👑 Tagessieger und das 🎖 Treue-Abzeichen ab 10 Abenden). Youngstars: Bier steht zuunterst |
| `/<bereich>/tv` | TV-Scoreboard: umschaltbar All-Time / Heute / Archiv-Abend (animiert, benannte Abende stehen mit ihrem Namen im Titel; „Heute" zeigt nur, wer heute geloggt hat), Podest Top 3, QR-Code zum Beitritt, ab Platz 4 durchscrollende Liste (Tempo im Admin einstellbar), Live-Fun-Facts inkl. eigener Meldungen und Statistik-Facts (Rekorde, Tages-Bestleistungen, Comeback nach langer Pause, runde Marken, Führungswechsel), Rekordkurs-Anzeige 🔥 wenn der Abend schneller läuft als der beste bisherige. Skaliert als 1080p-Design-Bühne — sieht auf jeder Auflösung identisch aus |
| `/<bereich>/admin` | Admin: Nutzer & Zähler (Bier/Shots/Mischen) verwalten, in der Gesamtansicht und in der Anmeldeliste ein-/ausblenden, TV-Ansicht (inkl. Archiv-Abend) & Rotationstempo einstellen, eigene Fun-Facts pflegen und bearbeiten, QR-Adresse setzen, **Backup herunterladen und einspielen**, Komplett-Reset (mit Lösch-Passwort, löscht nur den eigenen Bereich) |
| `/<bereich>/abende` | Abend-Archiv: jeder Party-Tag als Karte mit Sieger 👑, Teilnehmerzahl, Gesamtmengen und dem **Verlauf des Abends** (Getränke pro Stunde, alle zusammen, Spitzenstunde hervorgehoben). Mit Admin-Login zusätzlich: **CSV-Download** je Abend und über alle Abende, Abend nachträglich korrigieren (±1 je Spieler/Getränk, wirkt auf Log + All-Time), **Abend benennen** (Feld im Bearbeiten-Dialog; der Name steht auf der Karte und im TV-Titel) und „Auf dem TV zeigen" |

### Übergabedatei (CSV) aus dem Abend-Archiv

Auf `/<bereich>/abende` liefert **„⬇ CSV"** die Teilnehmerliste eines einzelnen
Abends, **„⬇ Alle Abende als CSV"** oben rechts alle Abende in einer Datei.
Beide Knöpfe erscheinen **nur mit Admin-Login** — genauso wie „Bearbeiten" und
„Auf dem TV zeigen"; ohne gültiges Admin-Token antworten die Endpunkte mit 403
(D-027). Die Karten mit Sieger, Teilnehmerzahl und Tagessummen bleiben für alle
sichtbar.

Format: eine Zeile **je Abend und Person** (Langformat, direkt als Pivot
auswertbar), Spalten
`Tag;Datum;Wochentag;Name;Bier;Shots;Mischen;Gesamt`. Trennzeichen ist das
Semikolon, die Datei hat ein UTF-8-BOM — deutsches Excel und LibreOffice
öffnen sie per Doppelklick korrekt inklusive Umlauten. `Tag` ist zusätzlich in
ISO-Form (`2026-08-22`) dabei, damit sich die Datei auch maschinell sortieren
lässt. Personen ohne Getränke an dem Abend stehen nicht drin; eine Summenzeile
gibt es bewusst nicht.

Die Dateien heißen `partykeller-abend-2026-08-22.csv` bzw.
`partykeller-abende-gesamt.csv` (Youngstars entsprechend), die Endpunkte
dahinter sind `GET /<bereich>/api/export/archive[/<tag>]` mit dem Admin-Token
im `Authorization`-Header.

### Sicherung: alles herunterladen und im Notfall wiederherstellen

Im Admin-Bereich unter **Sicherung**:

- **⬇ Backup herunterladen** speichert den kompletten Bereich als eine
  JSON-Datei (`partykeller-backup-2026-09-01.json`): alle Nutzer mit ID,
  PIN-Hash, Zählern und Sichtbarkeit, das gesamte Getränke-Log, die
  Einstellungen (TV-Ansicht, Abend-Namen, QR-Adresse, Tempi) und die eigenen
  Fun-Facts. Am besten nach jedem Abend einmal auf einen USB-Stick oder in die
  Cloud legen.
- **⬆ Backup einspielen** stellt daraus alles wieder her — z. B. auf einem
  neuen Laptop oder nach einer kaputten SD-Karte. Das **ersetzt** den
  kompletten Bestand des Bereichs, deshalb ist wie beim Komplett-Reset das
  **Lösch-Passwort** nötig. Geht beim Einspielen etwas schief (kaputte Datei,
  Sicherung des anderen Bereichs), bleibt der alte Stand unangetastet.

Jeder Bereich hat seine eigene Sicherung: eine Partykeller-Datei lässt sich
nicht in den Youngstars-Bereich einspielen (und umgekehrt).

Wichtig: Die **`.env` ist nicht Teil der Sicherung** — sie muss getrennt
aufgehoben werden. Nur mit demselben `TOKEN_SECRET` bleiben nach der
Wiederherstellung auch die Logins auf den Handys gültig; mit einem neuen
Secret müssen sich alle einmal neu anmelden (die PINs stimmen weiterhin).

Die Endpunkte dahinter sind `GET /<bereich>/api/export/backup` und
`POST /<bereich>/api/import/backup`, beide nur mit Admin-Token im
`Authorization`-Header (D-034).

Die App ist als **PWA installierbar**: Seite am Handy öffnen → „Zum
Startbildschirm hinzufügen" — dann liegt der Counter als App-Icon auf dem
Home-Screen (funktioniert komplett offline im WLAN, es wird nichts gecacht).
Partykeller und Youngstars haben eigene Manifeste und Icons und können als
zwei getrennte Apps nebeneinander installiert werden.

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

Der Betrieb funktioniert genauso auf einem Laptop (`npm start`, TV-Browser im
Vollbild auf `/tv` — F11 in Chrome); die Pi-Anleitung bleibt für den Fall der
Fälle erhalten.

Anleitung in [deploy/PI-SETUP.md](deploy/PI-SETUP.md): systemd-Service
([deploy/partykeller.service](deploy/partykeller.service)), mDNS-Name
`partykeller.local`, TV im Chromium-Kiosk-Modus auf `/tv`, Backup der
`data/partykeller.db`. Konfiguration über `.env` (siehe `.env.example`).
