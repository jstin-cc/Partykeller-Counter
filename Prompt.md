Rolle: Du planst und startest die Umsetzung einer kleinen Web-App und setzt
danach den ersten Screen um. Plane zuerst, code Features erst nach meiner
Freigabe.

SCHRITT 01 - DESIGN IMPORTIEREN
Verbinde dich mit der Claude Design MCP (https://api.anthropic.com/v1/design/mcp,
Auth über /design-login) und importiere dieses Projekt:
https://claude.ai/design/p/88f5d903-cd4e-489d-9ce7-d904fffe8155?file=User+Dashboard+v3.dc.html
Umzusetzendes File: User Dashboard v3.dc.html
Sieh dir das importierte Design genau an (Farben, Typo, Komponenten, Layout),
bevor du planst. Das Design ist verbindliche Vorlage für die Optik.

WAS WIR BAUEN
Ein Getränke-Counter für einen Partykeller. Gäste zählen ihre Biere und Shots
über das Handy, ein Fernseher zeigt die dauerhafte All-Time-Rangliste aller
Teilnehmer. Läuft komplett im lokalen WLAN (z. B. auf einem Raspberry Pi), keine
Internet-Abhängigkeit. Handys und TV sind nur Clients, die auf denselben Server
zugreifen.

CLIENTS / SCREENS

- TV-Scoreboard (Querformat): All-Time-Rangliste, Podest für Top 3, laufend live.
- Nutzer-Login (Handy, Hochformat): Name wählen/anlegen, optionale PIN.
- Nutzer-Dashboard (Handy, Hochformat): eigene Bier- und Shot-Zähler mit Plus/
  Minus, eigener Gesamtstand und Rang. Das ist der zu implementierende Screen.
- Admin-Login (Passwort).
- Admin-Dashboard: alle Nutzer verwalten (anlegen, umbenennen, löschen) UND die
  Bier-/Shot-Zähler jedes Nutzers direkt bearbeiten. Plus ein geschützter
  Komplett-Reset.

ACCOUNTS & VERHALTEN

- Pro Nutzer ein Account, der über alle Abende hinweg bestehen bleibt.
- Wertung ist All-Time: Zählstände summieren sich dauerhaft und werden nie
  automatisch zurückgesetzt. Reset nur manuell durch den Admin.
- Jede Änderung an einem Handy aktualisiert den TV und alle anderen Clients
  sofort (WebSocket).
- Persistenz zwingend, ein Neustart darf nichts verlieren.
- Beitritt per QR-Code, der auf dem Scoreboard angezeigt wird.

DATENMODELL (Startpunkt, in der Planung verfeinern)
players: { id, name, pin (optional), beers, shots, created_at }
Gesamt wird abgeleitet (beers + shots).
Nachrichten: increment(playerId, drink, delta), addPlayer(name),
renamePlayer(id, name), deletePlayer(id), reset(). Server broadcastet nach jeder
Änderung den State an alle Clients.

TECH-VORGABE (Default, in DECISIONS.md festhalten)
Node.js + Express (statische Seiten + API), ws für WebSockets, SQLite via
better-sqlite3 für Persistenz. Ein Prozess serviert alle Views. Falls du Rust
für sinnvoller hältst, schlag es im Plan vor, aber setze Node als Default.

DEINE AUFGABE IN DIESER SESSION

1. Erstelle einen Plan: Architektur, Stack bestätigen, Datenmodell, API- und
   WebSocket-Contract, Routen und Screens, Ordnerstruktur, Meilensteine.
2. Berücksichtige den Betrieb: ein deploybarer Prozess, konfigurierbarer Port,
   späterer Start per systemd auf einem Pi, Scoreboard im Kiosk-Browser,
   Zugriff über einen mDNS-Namen (z. B. partykeller.local). Jetzt nur einplanen,
   nicht ausbauen.
3. Lege das Projekt-Gerüst und die Kontextdateien an: CLAUDE.md (Projektregeln,
   Stack, Konventionen), PROGRESS.md (Meilensteine, Status), DECISIONS.md
   (Architektur- und Stack-Entscheidungen mit Begründung). Die Schritte im Plan sollen 
   sauber in einer .MD Datei aufgeführt sein und nach abgehakt werden um den aktuellen Stand
   im Fall von Kontextverlust beizubehalten. Das Repo ist immer sauber und klar strukturiert zu halten 
4. Schreibe noch keinen Feature-Code, bis ich den Plan bestätigt habe.
   
   

IN DER PLANUNG MIT EMPFEHLUNG ZU KLÄREN

- Stack: Node (empfohlen) vs Rust.
- PIN pro Nutzer: ja oder nein (Empfehlung: optional, standardmäßig aus).
- Admin-Passwort: fest im Code vs konfigurierbar über .env (Empfehlung: .env).

Arbeite strukturiert, halte Entscheidungen in DECISIONS.md fest und aktualisiere
PROGRESS.md nach jedem Schritt.
