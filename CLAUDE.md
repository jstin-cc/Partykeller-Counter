# CLAUDE.md — Projektregeln Getränke-Counter Partykeller

## Was das ist

Getränke-Counter für einen Partykeller: Gäste zählen Biere/Shots/Mischen am
Handy, ein TV zeigt die All-Time-Rangliste. Läuft als **ein Node.js-Prozess** auf
einem Raspberry Pi im lokalen WLAN, **ohne Internet**. Vollständiger Plan in
[PLAN.md](PLAN.md), Entscheidungen in [DECISIONS.md](DECISIONS.md), Stand in
[PROGRESS.md](PROGRESS.md).

## Stack (festgelegt, siehe D-001)

- Node.js, Express (Statics + REST), `ws` (WebSockets), `better-sqlite3`, `dotenv`
- Frontend: statisches HTML/CSS/Vanilla-JS (ES-Module), **kein Build-Step, kein Framework**
- DB: SQLite in `data/partykeller.db` (WAL), Schema in PLAN.md §3

## Harte Regeln

1. **PROGRESS.md nach jedem abgeschlossenen Schritt aktualisieren** (abhaken,
   „Aktueller Stand" pflegen) und mitcommitten — sie ist die
   Kontextverlust-Sicherung.
2. Jede Architektur-/Stack-Entscheidung als neuer Eintrag in **DECISIONS.md**
   (Datum, Entscheidung, Begründung). Bestehende Einträge nicht umschreiben.
3. README.md und CLAUDE.md bei relevanten Änderungen sofort mitziehen.
4. **Keine CDN-/Internet-Ressourcen im Frontend** — alles wird in `public/`
   vendored (Fonts, Libs). Die App muss offline im WLAN funktionieren.
5. Keine Secrets im Repo: `ADMIN_PASSWORD`, `RESET_PASSWORD` und `TOKEN_SECRET`
   nur über `.env` (Vorlage: `.env.example`). Der Design-Prototyp-Wert
   `keller2026` wird nie übernommen.
6. Server validiert jede Mutation (Token, Rolle, Wertebereiche); Nutzer dürfen
   nur den eigenen Zähler um +1 erhöhen, alles andere ist Admin (D-004).
7. Persistenz ist zwingend: Ein Server-Neustart darf keine Daten und keine
   Logins verlieren (D-006).

## Design (verbindlich)

- Quelle: Claude-Design-Projekt „Getränke-Counter Partykeller"
  (`88f5d903-cd4e-489d-9ce7-d904fffe8155`), **immer die v3-Dateien**.
- Design-Tokens (oklch-Farben, Bitter + Work Sans) in PLAN.md §8 → `public/css/theme.css`.
- UI-Sprache ist Deutsch. Zähler mit `font-variant-numeric: tabular-nums`.

## Konventionen

- Sprache im Repo (Doku, Commits): Deutsch; Code-Bezeichner Englisch.
- Commits: klein, beschreibend, ein Thema pro Commit.
- Keine neuen npm-Dependencies ohne DECISIONS.md-Eintrag.
- `data/` und `.env` sind gitignored; niemals committen.

## Status

Alle Meilensteine (M0–M7) sind umgesetzt, die App ist funktional komplett.
Aktueller Stand und offene Restpunkte stehen immer in PROGRESS.md — vor
jeder Arbeit dort nachsehen.
